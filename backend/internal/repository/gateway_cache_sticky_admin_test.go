package repository

import (
	"context"
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/cespare/xxhash/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

type stickySessionMetadataStub struct {
	usage      []stickySessionUsageMetadata
	groupNames map[int64]string
}

func (s *stickySessionMetadataStub) LoadRecentUsage(context.Context, int64, time.Time) ([]stickySessionUsageMetadata, error) {
	return s.usage, nil
}

func (s *stickySessionMetadataStub) LoadGroupNames(context.Context, []int64) (map[int64]string, error) {
	return s.groupNames, nil
}

func newStickySessionManagerTest(t *testing.T, metadata *stickySessionMetadataStub) (*miniredis.Miniredis, *redis.Client, *accountStickySessionManager) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return server, client, &accountStickySessionManager{rdb: client, metadata: metadata}
}

func TestAccountStickySessionManagerListsBindingsWithBestEffortMetadata(t *testing.T) {
	lastSeenAt := time.Now().Add(-time.Minute).UTC().Truncate(time.Second)
	metadata := &stickySessionMetadataStub{
		groupNames: map[int64]string{3: "OpenAI 项目"},
		usage: []stickySessionUsageMetadata{{
			SessionID:  "client-session-1",
			GroupID:    3,
			UserID:     9,
			Username:   "alice",
			UserEmail:  "alice@example.com",
			APIKeyID:   11,
			APIKeyName: "开发项目",
			Model:      "gpt-5.6",
			RequestID:  "req-1",
			LastSeenAt: lastSeenAt,
		}},
	}
	server, client, manager := newStickySessionManagerTest(t, metadata)

	hash := fmt.Sprintf("%016x", xxhash.Sum64String("client-session-1"))
	key := "sticky_session:3:openai:" + hash
	require.NoError(t, client.Set(context.Background(), key, "42", time.Hour).Err())
	require.NoError(t, client.Set(context.Background(), "sticky_session:3:other", "7", time.Hour).Err())

	sessions, err := manager.ListAccountStickySessions(context.Background(), 42)

	require.NoError(t, err)
	require.Len(t, sessions, 1)
	require.Equal(t, base64.RawURLEncoding.EncodeToString([]byte(key)), sessions[0].ID)
	require.Equal(t, int64(3), sessions[0].GroupID)
	require.Equal(t, "OpenAI 项目", sessions[0].GroupName)
	require.Equal(t, int64(9), *sessions[0].UserID)
	require.Equal(t, "alice@example.com", sessions[0].UserEmail)
	require.Equal(t, int64(11), *sessions[0].APIKeyID)
	require.Equal(t, "开发项目", sessions[0].APIKeyName)
	require.Equal(t, "gpt-5.6", sessions[0].Model)
	require.Equal(t, lastSeenAt, *sessions[0].LastSeenAt)
	require.True(t, server.Exists("sticky_session:3:other"))
}

func TestAccountStickySessionManagerClearAllOnlyDeletesMatchingBindings(t *testing.T) {
	server, client, manager := newStickySessionManagerTest(t, &stickySessionMetadataStub{})
	ctx := context.Background()
	require.NoError(t, client.Set(ctx, "sticky_session:1:current", "42", time.Hour).Err())
	require.NoError(t, client.Set(ctx, "sticky_session:2:legacy", "42", time.Hour).Err())
	require.NoError(t, client.Set(ctx, "sticky_session:1:other-account", "7", time.Hour).Err())
	require.NoError(t, client.Set(ctx, "openai_responses_session_window:1:current", "42", time.Hour).Err())
	require.NoError(t, client.Set(ctx, "unrelated:sticky_session:1", "42", time.Hour).Err())

	cleared, err := manager.ClearAccountStickySessions(ctx, 42)

	require.NoError(t, err)
	require.Equal(t, int64(2), cleared)
	require.False(t, server.Exists("sticky_session:1:current"))
	require.False(t, server.Exists("sticky_session:2:legacy"))
	require.True(t, server.Exists("sticky_session:1:other-account"))
	require.True(t, server.Exists("openai_responses_session_window:1:current"))
	require.True(t, server.Exists("unrelated:sticky_session:1"))
}

func TestAccountStickySessionManagerClearOneKeepsConcurrentlyReboundSession(t *testing.T) {
	server, client, manager := newStickySessionManagerTest(t, &stickySessionMetadataStub{})
	ctx := context.Background()
	key := "sticky_session:1:current"
	require.NoError(t, client.Set(ctx, key, "7", time.Hour).Err())

	cleared, err := manager.ClearAccountStickySession(
		ctx,
		42,
		base64.RawURLEncoding.EncodeToString([]byte(key)),
	)

	require.NoError(t, err)
	require.False(t, cleared)
	value, err := server.Get(key)
	require.NoError(t, err)
	require.Equal(t, "7", value)
}

func TestSQLAccountStickySessionMetadataReaderLoadsUsageAndGroups(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	reader := &sqlAccountStickySessionMetadataReader{db: db}
	lastSeenAt := time.Now().UTC().Truncate(time.Second)

	mock.ExpectQuery(`(?s)SELECT\s+ul\.session_id,.+FROM usage_logs ul`).
		WithArgs(int64(42), sqlmock.AnyArg(), stickySessionMetadataLimit).
		WillReturnRows(sqlmock.NewRows([]string{
			"session_id", "group_id", "user_id", "username", "email", "api_key_id", "api_key_name", "model", "request_id", "created_at",
		}).AddRow("client-session", int64(3), int64(9), "alice", "alice@example.com", int64(11), "开发项目", "gpt-5.6", "req-1", lastSeenAt))

	usage, err := reader.LoadRecentUsage(context.Background(), 42, lastSeenAt.Add(-time.Hour))
	require.NoError(t, err)
	require.Len(t, usage, 1)
	require.Equal(t, "alice@example.com", usage[0].UserEmail)
	require.Equal(t, "开发项目", usage[0].APIKeyName)

	mock.ExpectQuery(`SELECT id, name FROM groups WHERE id IN \(\$1,\$2\)`).
		WithArgs(int64(3), int64(5)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(int64(3), "OpenAI 项目").AddRow(int64(5), "备用项目"))

	groups, err := reader.LoadGroupNames(context.Background(), []int64{3, 5})
	require.NoError(t, err)
	require.Equal(t, "OpenAI 项目", groups[3])
	require.Equal(t, "备用项目", groups[5])
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestIndexStickySessionUsageRejectsAmbiguousUserMatch(t *testing.T) {
	items := []stickySessionUsageMetadata{
		{SessionID: "shared-session", GroupID: 3, UserID: 9, APIKeyID: 11},
		{SessionID: "shared-session", GroupID: 3, UserID: 10, APIKeyID: 12},
	}
	hash := fmt.Sprintf("%016x", xxhash.Sum64String("shared-session"))

	indexed := indexStickySessionUsage(items)

	_, matched := indexed[stickySessionUsageIndexKey(3, "openai:"+hash)]
	require.False(t, matched, "shared session identifiers must not be attributed to one user")
}
