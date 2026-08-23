package routes

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	pkghttputil "github.com/Wei-Shaw/sub2api/internal/pkg/httputil"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const playgroundAPIKeyIDHeader = "X-Playground-API-Key-ID"

type playgroundAPIKeyStore interface {
	GetByID(ctx context.Context, id int64) (*service.APIKey, error)
	List(ctx context.Context, userID int64, params pagination.PaginationParams, filters service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error)
}

type playgroundModelSupport func(ctx context.Context, group *service.Group, modelID string) bool

func rejectPlaygroundImageGeneration(c *gin.Context) {
	body, err := pkghttputil.ReadRequestBodyWithPrealloc(c.Request)
	if err != nil {
		response.BadRequest(c, "Failed to read request body")
		c.Abort()
		return
	}
	resetRequestBody(c, body)

	model := strings.TrimSpace(gjson.GetBytes(body, "model").String())
	if service.IsImageGenerationModel(model) || service.IsImageGenerationIntent("/v1/responses", model, body) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"type":    "invalid_request_error",
				"message": "Image generation is not supported in Playground",
			},
		})
		c.Abort()
		return
	}
	c.Next()
}

type playgroundAPIKeyOption struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	GroupID       int64  `json:"group_id"`
	GroupName     string `json:"group_name"`
	GroupPlatform string `json:"group_platform"`
}

type imagePlaygroundAPIKeyOption struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Key       string `json:"key"`
	GroupID   int64  `json:"group_id"`
	GroupName string `json:"group_name"`
}

func listPlaygroundAPIKeys(store playgroundAPIKeyStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := middleware.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			return
		}
		if store == nil {
			response.InternalError(c, "Playground is unavailable")
			return
		}

		keys, _, err := store.List(c.Request.Context(), subject.UserID, pagination.PaginationParams{
			Page:      1,
			PageSize:  1000,
			SortBy:    "created_at",
			SortOrder: "desc",
		}, service.APIKeyListFilters{Status: service.StatusAPIKeyActive})
		if err != nil {
			response.ErrorFrom(c, err)
			return
		}

		options := make([]playgroundAPIKeyOption, 0, len(keys))
		for i := range keys {
			key := &keys[i]
			if !key.IsActive() || key.GroupID == nil || key.Group == nil || !key.Group.IsActive() {
				continue
			}
			options = append(options, playgroundAPIKeyOption{
				ID:            key.ID,
				Name:          key.Name,
				GroupID:       key.Group.ID,
				GroupName:     key.Group.Name,
				GroupPlatform: key.Group.Platform,
			})
		}

		response.Success(c, options)
	}
}

func listImagePlaygroundAPIKeys(store playgroundAPIKeyStore, supportsModel playgroundModelSupport) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := middleware.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			return
		}
		if store == nil || supportsModel == nil {
			response.InternalError(c, "Image playground is unavailable")
			return
		}

		keys, _, err := store.List(c.Request.Context(), subject.UserID, pagination.PaginationParams{
			Page:      1,
			PageSize:  1000,
			SortBy:    "created_at",
			SortOrder: "desc",
		}, service.APIKeyListFilters{Status: service.StatusAPIKeyActive})
		if err != nil {
			response.ErrorFrom(c, err)
			return
		}

		groupSupport := make(map[int64]bool)
		checkedGroups := make(map[int64]bool)
		options := make([]imagePlaygroundAPIKeyOption, 0, len(keys))
		for i := range keys {
			key := &keys[i]
			if key.UserID != subject.UserID || !key.IsActive() || strings.TrimSpace(key.Key) == "" || key.GroupID == nil || key.Group == nil || !key.Group.IsActive() {
				continue
			}
			if !checkedGroups[key.Group.ID] {
				groupSupport[key.Group.ID] = supportsModel(c.Request.Context(), key.Group, "gpt-image-2")
				checkedGroups[key.Group.ID] = true
			}
			if !groupSupport[key.Group.ID] {
				continue
			}
			options = append(options, imagePlaygroundAPIKeyOption{
				ID:        key.ID,
				Name:      key.Name,
				Key:       key.Key,
				GroupID:   key.Group.ID,
				GroupName: key.Group.Name,
			})
		}

		response.Success(c, options)
	}
}

// useOwnedPlaygroundAPIKey exchanges the opaque key ID supplied by the UI for
// the user's real API key on the server. The secret never appears in the
// playground response or browser storage.
func useOwnedPlaygroundAPIKey(store playgroundAPIKeyStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := middleware.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			c.Abort()
			return
		}

		rawID := strings.TrimSpace(c.GetHeader(playgroundAPIKeyIDHeader))
		c.Request.Header.Del(playgroundAPIKeyIDHeader)
		keyID, err := strconv.ParseInt(rawID, 10, 64)
		if err != nil || keyID <= 0 {
			response.BadRequest(c, fmt.Sprintf("%s header must contain a valid API key ID", playgroundAPIKeyIDHeader))
			c.Abort()
			return
		}
		if store == nil {
			response.InternalError(c, "Playground is unavailable")
			c.Abort()
			return
		}

		apiKey, err := store.GetByID(c.Request.Context(), keyID)
		if err != nil {
			if errors.Is(err, service.ErrAPIKeyNotFound) {
				response.NotFound(c, "API key not found")
			} else {
				response.InternalError(c, "Failed to load API key")
			}
			c.Abort()
			return
		}
		if apiKey == nil || apiKey.UserID != subject.UserID {
			response.NotFound(c, "API key not found")
			c.Abort()
			return
		}
		if strings.TrimSpace(apiKey.Key) == "" {
			response.InternalError(c, "API key is unavailable")
			c.Abort()
			return
		}

		originalAuthorization := c.GetHeader("Authorization")
		c.Request.Header.Set("Authorization", "Bearer "+apiKey.Key)
		defer func() {
			if originalAuthorization == "" {
				c.Request.Header.Del("Authorization")
				return
			}
			c.Request.Header.Set("Authorization", originalAuthorization)
		}()
		c.Next()
	}
}

func registerPlaygroundGatewayRoutes(
	r *gin.Engine,
	handlerModels gin.HandlerFunc,
	handlerResponses gin.HandlerFunc,
	supportsModel playgroundModelSupport,
	jwtAuth middleware.JWTAuthMiddleware,
	apiKeyAuth middleware.APIKeyAuthMiddleware,
	apiKeyService *service.APIKeyService,
	bodyLimit gin.HandlerFunc,
	clientRequestID gin.HandlerFunc,
	opsErrorLogger gin.HandlerFunc,
	endpointNorm gin.HandlerFunc,
	compositeTarget gin.HandlerFunc,
	requireGroup gin.HandlerFunc,
) {
	if jwtAuth == nil || apiKeyAuth == nil || apiKeyService == nil {
		return
	}

	commonMiddleware := []gin.HandlerFunc{
		bodyLimit,
		clientRequestID,
		opsErrorLogger,
		endpointNorm,
		gin.HandlerFunc(jwtAuth),
	}
	keyedMiddleware := []gin.HandlerFunc{
		useOwnedPlaygroundAPIKey(apiKeyService),
		gin.HandlerFunc(apiKeyAuth),
		compositeTarget,
		requireGroup,
	}

	playground := r.Group("/api/v1/user/playground")
	playground.Use(commonMiddleware...)
	playground.GET("/api-keys", listPlaygroundAPIKeys(apiKeyService))
	playground.GET("/image-api-keys", listImagePlaygroundAPIKeys(apiKeyService, supportsModel))

	keyed := playground.Group("")
	keyed.Use(keyedMiddleware...)
	keyed.GET("/models", handlerModels)

	responses := r.Group("/v1/playground")
	responses.Use(commonMiddleware...)
	responses.Use(keyedMiddleware...)
	responses.POST("/responses", rejectPlaygroundImageGeneration, handlerResponses)
}

var _ playgroundAPIKeyStore = (*service.APIKeyService)(nil)
