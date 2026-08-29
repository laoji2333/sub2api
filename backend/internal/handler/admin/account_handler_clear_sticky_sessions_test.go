//go:build unit

package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type stickySessionsAdminServiceStub struct {
	service.AdminService
	account *service.Account
	err     error
}

func (s *stickySessionsAdminServiceStub) GetAccount(_ context.Context, _ int64) (*service.Account, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.account, nil
}

type stickySessionsManagerStub struct {
	listAccountID     int64
	clearAccountID    int64
	clearOneAccountID int64
	clearOneSessionID string
	sessions          []service.AccountStickySession
	cleared           int64
	clearedOne        bool
	err               error
}

func (s *stickySessionsManagerStub) ListAccountStickySessions(_ context.Context, accountID int64) ([]service.AccountStickySession, error) {
	s.listAccountID = accountID
	return s.sessions, s.err
}

func (s *stickySessionsManagerStub) ClearAccountStickySession(_ context.Context, accountID int64, sessionID string) (bool, error) {
	s.clearOneAccountID = accountID
	s.clearOneSessionID = sessionID
	return s.clearedOne, s.err
}

func (s *stickySessionsManagerStub) ClearAccountStickySessions(_ context.Context, accountID int64) (int64, error) {
	s.clearAccountID = accountID
	return s.cleared, s.err
}

func newStickySessionsHandler(adminService service.AdminService, manager service.AccountStickySessionManager) *AccountHandler {
	handler := NewAccountHandler(adminService, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	handler.SetStickySessionManager(manager)
	return handler
}

func TestAccountHandlerListStickySessions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	manager := &stickySessionsManagerStub{sessions: []service.AccountStickySession{{ID: "session-1", GroupID: 3}}}
	handler := newStickySessionsHandler(&stickySessionsAdminServiceStub{account: &service.Account{ID: 42}}, manager)
	router := gin.New()
	router.GET("/api/v1/admin/accounts/:id/sticky-sessions", handler.ListStickySessions)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/accounts/42/sticky-sessions", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, int64(42), manager.listAccountID)
	var body struct {
		Data struct {
			Sessions []service.AccountStickySession `json:"sessions"`
			Total    int                            `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, 1, body.Data.Total)
	require.Equal(t, "session-1", body.Data.Sessions[0].ID)
}

func TestAccountHandlerClearOneStickySession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	manager := &stickySessionsManagerStub{clearedOne: true}
	handler := newStickySessionsHandler(&stickySessionsAdminServiceStub{account: &service.Account{ID: 42}}, manager)
	router := gin.New()
	router.POST("/api/v1/admin/accounts/:id/clear-sticky-session", handler.ClearStickySession)
	recorder := httptest.NewRecorder()
	body := bytes.NewBufferString(`{"session_id":"opaque-session"}`)
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/accounts/42/clear-sticky-session", body))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, int64(42), manager.clearOneAccountID)
	require.Equal(t, "opaque-session", manager.clearOneSessionID)
}

func TestAccountHandlerClearStickySessions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("clears only after the account is resolved", func(t *testing.T) {
		manager := &stickySessionsManagerStub{cleared: 3}
		handler := newStickySessionsHandler(&stickySessionsAdminServiceStub{account: &service.Account{ID: 42}}, manager)
		router := gin.New()
		router.POST("/api/v1/admin/accounts/:id/clear-sticky-sessions", handler.ClearStickySessions)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/accounts/42/clear-sticky-sessions", nil))

		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, int64(42), manager.clearAccountID)
		var body struct {
			Data struct {
				ClearedCount int64 `json:"cleared_count"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
		require.Equal(t, int64(3), body.Data.ClearedCount)
	})

	t.Run("does not scan when the account lookup fails", func(t *testing.T) {
		manager := &stickySessionsManagerStub{cleared: 3}
		handler := newStickySessionsHandler(&stickySessionsAdminServiceStub{err: errors.New("account lookup failed")}, manager)
		router := gin.New()
		router.POST("/api/v1/admin/accounts/:id/clear-sticky-sessions", handler.ClearStickySessions)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/accounts/42/clear-sticky-sessions", nil))

		require.Equal(t, http.StatusInternalServerError, recorder.Code)
		require.Zero(t, manager.clearAccountID)
	})

	t.Run("rejects an invalid account id before lookup", func(t *testing.T) {
		manager := &stickySessionsManagerStub{cleared: 3}
		handler := newStickySessionsHandler(&stickySessionsAdminServiceStub{account: &service.Account{ID: 42}}, manager)
		router := gin.New()
		router.POST("/api/v1/admin/accounts/:id/clear-sticky-sessions", handler.ClearStickySessions)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/accounts/not-a-number/clear-sticky-sessions", nil))

		require.Equal(t, http.StatusBadRequest, recorder.Code)
		require.Zero(t, manager.clearAccountID)
	})
}
