package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/channelmonitor"
	_ "github.com/Wei-Shaw/sub2api/ent/runtime"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
)

func TestChannelMonitorListOrdersEnabledFirstThenConfiguredOrder(t *testing.T) {
	var capturedSQL string
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(captureEntQueryMatcher{actual: &capturedSQL}))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	driver := entsql.OpenDB(dialect.Postgres, db)
	client := dbent.NewClient(dbent.Driver(driver))
	t.Cleanup(func() { _ = client.Close() })
	repo := &channelMonitorRepository{client: client, db: db}

	mock.ExpectQuery("count channel monitors").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))
	mock.ExpectQuery("list channel monitors").
		WillReturnRows(sqlmock.NewRows(channelmonitor.Columns))

	items, total, err := repo.List(context.Background(), service.ChannelMonitorListParams{
		Page:     1,
		PageSize: 20,
	})
	require.NoError(t, err)
	require.Empty(t, items)
	require.Equal(t, int64(3), total)
	require.NoError(t, mock.ExpectationsWereMet())

	normalized := normalizeSQLWhitespace(capturedSQL)
	require.Contains(t, normalized, `ORDER BY "channel_monitors"."enabled" DESC, "channel_monitors"."sort_order" ASC, "channel_monitors"."id" ASC`)
}

func TestChannelMonitorListEnabledOrdersByConfiguredOrder(t *testing.T) {
	var capturedSQL string
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(captureEntQueryMatcher{actual: &capturedSQL}))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	driver := entsql.OpenDB(dialect.Postgres, db)
	client := dbent.NewClient(dbent.Driver(driver))
	t.Cleanup(func() { _ = client.Close() })
	repo := &channelMonitorRepository{client: client, db: db}

	mock.ExpectQuery("list enabled channel monitors").
		WillReturnRows(sqlmock.NewRows(channelmonitor.Columns))

	items, err := repo.ListEnabled(context.Background())
	require.NoError(t, err)
	require.Empty(t, items)
	require.NoError(t, mock.ExpectationsWereMet())

	normalized := normalizeSQLWhitespace(capturedSQL)
	require.Contains(t, normalized, `WHERE "channel_monitors"."enabled" ORDER BY "channel_monitors"."sort_order" ASC, "channel_monitors"."id" ASC`)
}
