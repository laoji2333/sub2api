package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	servermiddleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type playgroundAPIKeyStoreStub struct {
	key     *service.APIKey
	getErr  error
	keys    []service.APIKey
	listErr error
}

func (s *playgroundAPIKeyStoreStub) GetByID(context.Context, int64) (*service.APIKey, error) {
	return s.key, s.getErr
}

func (s *playgroundAPIKeyStoreStub) List(context.Context, int64, pagination.PaginationParams, service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error) {
	return s.keys, &pagination.PaginationResult{}, s.listErr
}

func TestUseOwnedPlaygroundAPIKeyExchangesOwnedIDWithoutForwardingSelectorHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &playgroundAPIKeyStoreStub{key: &service.APIKey{ID: 12, UserID: 7, Key: "sk-server-only"}}
	router := gin.New()
	afterAuthorization := ""
	router.Use(func(c *gin.Context) {
		c.Set(string(servermiddleware.ContextKeyUser), servermiddleware.AuthSubject{UserID: 7})
		c.Next()
		afterAuthorization = c.GetHeader("Authorization")
	})
	router.Use(useOwnedPlaygroundAPIKey(store))
	router.GET("/models", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"authorization": c.GetHeader("Authorization"),
			"selector":      c.GetHeader(playgroundAPIKeyIDHeader),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/models", nil)
	req.Header.Set("Authorization", "Bearer jwt-token")
	req.Header.Set(playgroundAPIKeyIDHeader, "12")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"authorization":"Bearer sk-server-only","selector":""}`, w.Body.String())
	require.Equal(t, "Bearer jwt-token", afterAuthorization)
}

func TestUseOwnedPlaygroundAPIKeyHidesForeignKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &playgroundAPIKeyStoreStub{key: &service.APIKey{ID: 12, UserID: 99, Key: "sk-foreign"}}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(servermiddleware.ContextKeyUser), servermiddleware.AuthSubject{UserID: 7})
		c.Next()
	})
	router.Use(useOwnedPlaygroundAPIKey(store))
	router.GET("/models", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodGet, "/models", nil)
	req.Header.Set(playgroundAPIKeyIDHeader, "12")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusNotFound, w.Code)
	require.NotContains(t, w.Body.String(), "sk-foreign")
}

func TestListPlaygroundAPIKeysReturnsSafeActiveGroupedOptions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(4)
	activeGroup := &service.Group{ID: groupID, Name: "Daily", Platform: service.PlatformOpenAI, Status: service.StatusActive}
	store := &playgroundAPIKeyStoreStub{keys: []service.APIKey{
		{ID: 12, UserID: 7, Key: "sk-must-not-leak", Name: "Main", Status: service.StatusAPIKeyActive, GroupID: &groupID, Group: activeGroup},
		{ID: 13, UserID: 7, Key: "sk-disabled", Name: "Disabled", Status: service.StatusAPIKeyDisabled, GroupID: &groupID, Group: activeGroup},
		{ID: 14, UserID: 7, Key: "sk-ungrouped", Name: "Ungrouped", Status: service.StatusAPIKeyActive},
	}}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(servermiddleware.ContextKeyUser), servermiddleware.AuthSubject{UserID: 7})
		c.Next()
	})
	router.GET("/api-keys", listPlaygroundAPIKeys(store))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api-keys", nil))

	require.Equal(t, http.StatusOK, w.Code)
	require.NotContains(t, w.Body.String(), "sk-")
	var payload struct {
		Data []playgroundAPIKeyOption `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, []playgroundAPIKeyOption{{
		ID: 12, Name: "Main", GroupID: 4, GroupName: "Daily", GroupPlatform: service.PlatformOpenAI,
	}}, payload.Data)
}

func TestRegisterPlaygroundGatewayRoutesUsesResponsesEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	noop := func(c *gin.Context) { c.Next() }

	registerPlaygroundGatewayRoutes(
		router,
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		servermiddleware.JWTAuthMiddleware(noop),
		servermiddleware.APIKeyAuthMiddleware(noop),
		&service.APIKeyService{},
		noop,
		noop,
		noop,
		noop,
		noop,
		noop,
	)

	routes := router.Routes()
	responsesRegistered := false
	legacyResponsesRegistered := false
	chatCompletionsRegistered := false
	for _, route := range routes {
		if route.Method == http.MethodPost && route.Path == "/v1/playground/responses" {
			responsesRegistered = true
		}
		if route.Method == http.MethodPost && route.Path == "/api/v1/user/playground/responses" {
			legacyResponsesRegistered = true
		}
		if route.Method == http.MethodPost && route.Path == "/api/v1/user/playground/chat/completions" {
			chatCompletionsRegistered = true
		}
	}

	require.True(t, responsesRegistered)
	require.False(t, legacyResponsesRegistered)
	require.False(t, chatCompletionsRegistered)
}
