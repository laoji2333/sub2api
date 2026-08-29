package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/cespare/xxhash/v2"
	"github.com/redis/go-redis/v9"
)

const (
	stickySessionScanCount        int64 = 200
	stickySessionMetadataLookback       = 48 * time.Hour
	stickySessionMetadataLimit          = 20000
)

var deleteStickySessionIfAccountMatchesScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`)

type stickySessionUsageMetadata struct {
	SessionID  string
	GroupID    int64
	UserID     int64
	Username   string
	UserEmail  string
	APIKeyID   int64
	APIKeyName string
	Model      string
	RequestID  string
	LastSeenAt time.Time
}

type accountStickySessionMetadataReader interface {
	LoadRecentUsage(ctx context.Context, accountID int64, since time.Time) ([]stickySessionUsageMetadata, error)
	LoadGroupNames(ctx context.Context, groupIDs []int64) (map[int64]string, error)
}

type sqlAccountStickySessionMetadataReader struct {
	db *sql.DB
}

type accountStickySessionManager struct {
	rdb      *redis.Client
	metadata accountStickySessionMetadataReader
}

// ProvideAccountStickySessionManager creates an admin-only reader/cleaner. It
// remains separate from GatewayCache so listing metadata cannot affect the
// request scheduling hot path.
func ProvideAccountStickySessionManager(rdb *redis.Client, db *sql.DB) service.AccountStickySessionManager {
	return &accountStickySessionManager{
		rdb:      rdb,
		metadata: &sqlAccountStickySessionMetadataReader{db: db},
	}
}

func (r *sqlAccountStickySessionMetadataReader) LoadRecentUsage(ctx context.Context, accountID int64, since time.Time) ([]stickySessionUsageMetadata, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT
  ul.session_id,
  COALESCE(ul.group_id, 0),
  ul.user_id,
  COALESCE(u.username, ''),
  COALESCE(u.email, ''),
  ul.api_key_id,
  COALESCE(k.name, ''),
  COALESCE(NULLIF(ul.requested_model, ''), ul.model),
  ul.request_id,
  ul.created_at
FROM usage_logs ul
LEFT JOIN users u ON u.id = ul.user_id
LEFT JOIN api_keys k ON k.id = ul.api_key_id
WHERE ul.account_id = $1
  AND ul.created_at >= $2
  AND ul.session_id IS NOT NULL
  AND BTRIM(ul.session_id) <> ''
ORDER BY ul.created_at DESC
LIMIT $3`, accountID, since, stickySessionMetadataLimit)
	if err != nil {
		return nil, fmt.Errorf("query sticky session usage metadata: %w", err)
	}
	defer rows.Close()

	items := make([]stickySessionUsageMetadata, 0)
	for rows.Next() {
		var item stickySessionUsageMetadata
		if err := rows.Scan(
			&item.SessionID,
			&item.GroupID,
			&item.UserID,
			&item.Username,
			&item.UserEmail,
			&item.APIKeyID,
			&item.APIKeyName,
			&item.Model,
			&item.RequestID,
			&item.LastSeenAt,
		); err != nil {
			return nil, fmt.Errorf("scan sticky session usage metadata: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sticky session usage metadata: %w", err)
	}
	return items, nil
}

func (r *sqlAccountStickySessionMetadataReader) LoadGroupNames(ctx context.Context, groupIDs []int64) (map[int64]string, error) {
	names := make(map[int64]string, len(groupIDs))
	if len(groupIDs) == 0 {
		return names, nil
	}

	placeholders := make([]string, 0, len(groupIDs))
	args := make([]any, 0, len(groupIDs))
	for i, groupID := range groupIDs {
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		args = append(args, groupID)
	}
	query := "SELECT id, name FROM groups WHERE id IN (" + strings.Join(placeholders, ",") + ")"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query sticky session groups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var groupID int64
		var name string
		if err := rows.Scan(&groupID, &name); err != nil {
			return nil, fmt.Errorf("scan sticky session group: %w", err)
		}
		names[groupID] = name
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sticky session groups: %w", err)
	}
	return names, nil
}

func (m *accountStickySessionManager) ListAccountStickySessions(ctx context.Context, accountID int64) ([]service.AccountStickySession, error) {
	bindings, err := m.findAccountBindings(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if len(bindings) == 0 {
		return []service.AccountStickySession{}, nil
	}

	groupIDs := uniqueStickySessionGroupIDs(bindings)
	groupNames, err := m.metadata.LoadGroupNames(ctx, groupIDs)
	if err != nil {
		return nil, err
	}
	usage, err := m.metadata.LoadRecentUsage(ctx, accountID, time.Now().Add(-stickySessionMetadataLookback))
	if err != nil {
		return nil, err
	}
	usageByBinding := indexStickySessionUsage(usage)

	sessions := make([]service.AccountStickySession, 0, len(bindings))
	for _, binding := range bindings {
		session := service.AccountStickySession{
			ID:               base64.RawURLEncoding.EncodeToString([]byte(binding.key)),
			Fingerprint:      stickySessionFingerprint(binding.sessionHash),
			GroupID:          binding.groupID,
			GroupName:        groupNames[binding.groupID],
			ExpiresInSeconds: binding.expiresInSeconds,
		}
		if metadata, ok := usageByBinding[stickySessionUsageIndexKey(binding.groupID, binding.sessionHash)]; ok {
			userID := metadata.UserID
			apiKeyID := metadata.APIKeyID
			session.UserID = &userID
			session.Username = metadata.Username
			session.UserEmail = metadata.UserEmail
			session.APIKeyID = &apiKeyID
			session.APIKeyName = metadata.APIKeyName
			session.Model = metadata.Model
			session.RequestID = metadata.RequestID
			lastSeenAt := metadata.LastSeenAt
			session.LastSeenAt = &lastSeenAt
		}
		sessions = append(sessions, session)
	}

	sort.Slice(sessions, func(i, j int) bool {
		if sessions[i].GroupID != sessions[j].GroupID {
			return sessions[i].GroupID < sessions[j].GroupID
		}
		return sessions[i].ExpiresInSeconds > sessions[j].ExpiresInSeconds
	})
	return sessions, nil
}

func (m *accountStickySessionManager) ClearAccountStickySession(ctx context.Context, accountID int64, sessionID string) (bool, error) {
	keyBytes, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(sessionID))
	if err != nil {
		return false, service.ErrInvalidStickySessionID.WithCause(err)
	}
	key := string(keyBytes)
	if _, _, ok := parseStickySessionKey(key); !ok {
		return false, service.ErrInvalidStickySessionID
	}
	deleted, err := deleteStickySessionIfAccountMatchesScript.Run(
		ctx,
		m.rdb,
		[]string{key},
		strconv.FormatInt(accountID, 10),
	).Int64()
	if err != nil {
		return false, fmt.Errorf("delete sticky session: %w", err)
	}
	return deleted == 1, nil
}

func (m *accountStickySessionManager) ClearAccountStickySessions(ctx context.Context, accountID int64) (int64, error) {
	bindings, err := m.findAccountBindings(ctx, accountID)
	if err != nil {
		return 0, err
	}
	target := strconv.FormatInt(accountID, 10)
	var deleted int64
	for _, binding := range bindings {
		count, err := deleteStickySessionIfAccountMatchesScript.Run(ctx, m.rdb, []string{binding.key}, target).Int64()
		if err != nil {
			return deleted, fmt.Errorf("delete sticky session: %w", err)
		}
		deleted += count
	}
	return deleted, nil
}

type accountStickyBinding struct {
	key              string
	groupID          int64
	sessionHash      string
	expiresInSeconds int64
}

func (m *accountStickySessionManager) findAccountBindings(ctx context.Context, accountID int64) ([]accountStickyBinding, error) {
	target := strconv.FormatInt(accountID, 10)
	matched := make(map[string]accountStickyBinding)
	var cursor uint64

	for {
		keys, nextCursor, err := m.rdb.Scan(ctx, cursor, stickySessionPrefix+"*", stickySessionScanCount).Result()
		if err != nil {
			return nil, fmt.Errorf("scan sticky sessions: %w", err)
		}
		if len(keys) > 0 {
			pipe := m.rdb.Pipeline()
			values := make([]*redis.StringCmd, 0, len(keys))
			ttls := make([]*redis.DurationCmd, 0, len(keys))
			for _, key := range keys {
				values = append(values, pipe.Get(ctx, key))
				ttls = append(ttls, pipe.TTL(ctx, key))
			}
			if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
				return nil, fmt.Errorf("read sticky sessions: %w", err)
			}
			for i, command := range values {
				value, err := command.Result()
				if err != nil || value != target {
					continue
				}
				groupID, sessionHash, ok := parseStickySessionKey(keys[i])
				if !ok {
					continue
				}
				ttl, err := ttls[i].Result()
				if err != nil || ttl == -2*time.Second {
					continue
				}
				expiresInSeconds := int64(-1)
				if ttl >= 0 {
					expiresInSeconds = int64(ttl / time.Second)
					if expiresInSeconds < 1 {
						expiresInSeconds = 1
					}
				}
				matched[keys[i]] = accountStickyBinding{
					key:              keys[i],
					groupID:          groupID,
					sessionHash:      sessionHash,
					expiresInSeconds: expiresInSeconds,
				}
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	bindings := make([]accountStickyBinding, 0, len(matched))
	for _, binding := range matched {
		bindings = append(bindings, binding)
	}
	return bindings, nil
}

func parseStickySessionKey(key string) (int64, string, bool) {
	remainder, ok := strings.CutPrefix(key, stickySessionPrefix)
	if !ok {
		return 0, "", false
	}
	groupPart, sessionHash, ok := strings.Cut(remainder, ":")
	if !ok || strings.TrimSpace(sessionHash) == "" {
		return 0, "", false
	}
	groupID, err := strconv.ParseInt(groupPart, 10, 64)
	if err != nil || groupID < 0 {
		return 0, "", false
	}
	return groupID, sessionHash, true
}

func uniqueStickySessionGroupIDs(bindings []accountStickyBinding) []int64 {
	seen := make(map[int64]struct{})
	for _, binding := range bindings {
		if binding.groupID > 0 {
			seen[binding.groupID] = struct{}{}
		}
	}
	ids := make([]int64, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

func stickySessionUsageIndexKey(groupID int64, sessionHash string) string {
	return strconv.FormatInt(groupID, 10) + ":" + sessionHash
}

func indexStickySessionUsage(items []stickySessionUsageMetadata) map[string]stickySessionUsageMetadata {
	type indexedMetadata struct {
		item      stickySessionUsageMetadata
		ambiguous bool
	}
	candidatesByBinding := make(map[string]indexedMetadata)
	for _, item := range items {
		for _, candidate := range stickySessionHashCandidates(item.SessionID, item.Model) {
			key := stickySessionUsageIndexKey(item.GroupID, candidate)
			existing, exists := candidatesByBinding[key]
			if !exists {
				candidatesByBinding[key] = indexedMetadata{item: item}
				continue
			}
			if existing.item.UserID != item.UserID || existing.item.APIKeyID != item.APIKeyID {
				existing.ambiguous = true
				candidatesByBinding[key] = existing
			}
		}
	}

	indexed := make(map[string]stickySessionUsageMetadata)
	for key, candidate := range candidatesByBinding {
		if !candidate.ambiguous {
			indexed[key] = candidate.item
		}
	}
	return indexed
}

func stickySessionHashCandidates(sessionID, model string) []string {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	candidates := make(map[string]struct{})
	addSessionHashCandidates(candidates, sessionID)
	candidates["gemini:"+sessionID] = struct{}{}

	model = strings.ToLower(strings.TrimSpace(model))
	if model != "" {
		addSessionHashCandidates(candidates, "grok-affinity:v1:"+model+":"+sessionID)
	}

	result := make([]string, 0, len(candidates))
	for candidate := range candidates {
		result = append(result, candidate)
	}
	return result
}

func addSessionHashCandidates(candidates map[string]struct{}, seed string) {
	candidates[seed] = struct{}{}
	current := fmt.Sprintf("%016x", xxhash.Sum64String(seed))
	legacySum := sha256.Sum256([]byte(seed))
	legacy := hex.EncodeToString(legacySum[:])
	candidates[current] = struct{}{}
	candidates[legacy] = struct{}{}
	candidates["openai:"+current] = struct{}{}
	candidates["openai:"+legacy] = struct{}{}
}

func stickySessionFingerprint(sessionHash string) string {
	const prefixLength = 12
	const suffixLength = 6
	if len(sessionHash) <= prefixLength+suffixLength+1 {
		return sessionHash
	}
	return sessionHash[:prefixLength] + "…" + sessionHash[len(sessionHash)-suffixLength:]
}
