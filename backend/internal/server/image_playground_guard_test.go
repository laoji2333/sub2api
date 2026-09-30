package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestImagePlaygroundAppGuard(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		for _, path := range []string{
			"/image-playground-app",
			"/image-playground-app/",
			"/image-playground-app/index.html",
			"/image-playground-app/assets/app.js",
		} {
			router := gin.New()
			router.Use(imagePlaygroundAppGuard(func() bool { return enabled }))
			router.GET("/*path", func(c *gin.Context) { c.Status(http.StatusOK) })

			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
			if enabled {
				require.Equal(t, http.StatusOK, response.Code, path)
			} else {
				require.Equal(t, http.StatusNotFound, response.Code, path)
				require.Equal(t, "no-store", response.Header().Get("Cache-Control"), path)
			}
		}
	}

	router := gin.New()
	router.Use(imagePlaygroundAppGuard(func() bool { return false }))
	router.GET("/*path", func(c *gin.Context) { c.Status(http.StatusOK) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/image-playground-app-other", nil))
	require.Equal(t, http.StatusOK, response.Code)
}
