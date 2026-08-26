//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type channelMonitorSortRepoStub struct {
	ChannelMonitorRepository
	updates []ChannelMonitorSortOrderUpdate
	err     error
}

func (r *channelMonitorSortRepoStub) UpdateSortOrders(_ context.Context, updates []ChannelMonitorSortOrderUpdate) error {
	r.updates = append([]ChannelMonitorSortOrderUpdate(nil), updates...)
	return r.err
}

func TestChannelMonitorServiceUpdateSortOrders(t *testing.T) {
	t.Run("forwards valid updates", func(t *testing.T) {
		repo := &channelMonitorSortRepoStub{}
		svc := NewChannelMonitorService(repo, nil)
		updates := []ChannelMonitorSortOrderUpdate{{ID: 7, SortOrder: 0}, {ID: 3, SortOrder: 10}}

		err := svc.UpdateSortOrders(context.Background(), updates)

		require.NoError(t, err)
		require.Equal(t, updates, repo.updates)
	})

	t.Run("rejects invalid id or order", func(t *testing.T) {
		for _, updates := range [][]ChannelMonitorSortOrderUpdate{
			{{ID: 0, SortOrder: 0}},
			{{ID: 1, SortOrder: -1}},
		} {
			repo := &channelMonitorSortRepoStub{}
			svc := NewChannelMonitorService(repo, nil)

			err := svc.UpdateSortOrders(context.Background(), updates)

			require.ErrorIs(t, err, ErrChannelMonitorInvalidSortOrder)
			require.Empty(t, repo.updates)
		}
	})

	t.Run("wraps repository errors", func(t *testing.T) {
		repoErr := errors.New("database unavailable")
		repo := &channelMonitorSortRepoStub{err: repoErr}
		svc := NewChannelMonitorService(repo, nil)

		err := svc.UpdateSortOrders(context.Background(), []ChannelMonitorSortOrderUpdate{{ID: 1, SortOrder: 0}})

		require.ErrorIs(t, err, repoErr)
	})
}
