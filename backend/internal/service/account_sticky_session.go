package service

import (
	"context"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

var ErrInvalidStickySessionID = infraerrors.BadRequest("INVALID_STICKY_SESSION_ID", "invalid sticky session id")

type AccountStickySession struct {
	ID               string     `json:"id"`
	Fingerprint      string     `json:"fingerprint"`
	GroupID          int64      `json:"group_id"`
	GroupName        string     `json:"group_name"`
	ExpiresInSeconds int64      `json:"expires_in_seconds"`
	UserID           *int64     `json:"user_id,omitempty"`
	Username         string     `json:"username,omitempty"`
	UserEmail        string     `json:"user_email,omitempty"`
	APIKeyID         *int64     `json:"api_key_id,omitempty"`
	APIKeyName       string     `json:"api_key_name,omitempty"`
	Model            string     `json:"model,omitempty"`
	RequestID        string     `json:"request_id,omitempty"`
	LastSeenAt       *time.Time `json:"last_seen_at,omitempty"`
}

// AccountStickySessionManager exposes account-scoped administrative inspection
// and cleanup without widening the gateway scheduling cache contract.
type AccountStickySessionManager interface {
	ListAccountStickySessions(ctx context.Context, accountID int64) ([]AccountStickySession, error)
	ClearAccountStickySession(ctx context.Context, accountID int64, sessionID string) (bool, error)
	ClearAccountStickySessions(ctx context.Context, accountID int64) (int64, error)
}
