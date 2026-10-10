import React from 'react';
import TestRenderer from 'react-test-renderer';
import { actCreate } from '../../../test-utils/render';
import { TamaguiTestProvider } from '../../../test-utils/tamagui';
import PlayerStatsList from '../../../components/history/PlayerStatsList';
import PeopleList from '../../../features/friends/PeopleList';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../../features/friends/FriendActions', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => require('react').createElement('FriendActionsMock', {
    ...props,
    testID: 'friend-actions',
  }),
}));
jest.mock('../../../components/history/PlayerDetailsModal', () => (props: unknown) =>
  require('react').createElement('PersonalDetails', props));
jest.mock('../../../components/history/PlayerComparisonModal', () => () => null);

const accountId = '00000000-0000-4000-8000-000000000002';
const player = {
  identityKey: JSON.stringify(['account', accountId]),
  name: 'Recorded name',
  contextLabel: null,
  totalDrinks: 6,
  gamesPlayed: 2,
  averagePerGame: 3,
};
const person = {
  account_id: accountId,
  username: 'CurrentName',
  relationship: 'friends' as const,
  request_id: null,
};

let tree: TestRenderer.ReactTestRenderer;

afterEach(() => {
  TestRenderer.act(() => tree.unmount());
});

it('opens a friend comparison from the player list', () => {
  const onOpenShared = jest.fn();
  tree = actCreate(
    <TamaguiTestProvider>
      <PlayerStatsList
        playerStats={[player]}
        history={[]}
        socialPeople={[person]}
        onOpenShared={onOpenShared}
      />
    </TamaguiTestProvider>,
  );

  const button = tree.root
    .findAllByProps({ accessibilityLabel: 'Rank 1, Recorded name, 6.0 drinks' })
    .find((node) => typeof node.props.onPress === 'function');
  TestRenderer.act(() => button!.props.onPress());

  expect(onOpenShared).toHaveBeenCalledWith(accountId);
});

it('keeps a nonfriend in the personal participation view', () => {
  const onOpenShared = jest.fn();
  tree = actCreate(
    <TamaguiTestProvider>
      <PlayerStatsList
        playerStats={[player]}
        history={[]}
        socialPeople={[{ ...person, relationship: 'outgoing' }]}
        onOpenShared={onOpenShared}
      />
    </TamaguiTestProvider>,
  );

  const button = tree.root
    .findAllByProps({ accessibilityLabel: 'Rank 1, Recorded name, 6.0 drinks' })
    .find((node) => typeof node.props.onPress === 'function');
  TestRenderer.act(() => button!.props.onPress());

  expect(onOpenShared).not.toHaveBeenCalled();
  expect(tree.root.findByType('PersonalDetails' as never).props.player.identityKey).toBe(player.identityKey);
});

it('opens a friend comparison through the supplied navigation callback', () => {
  const onOpenShared = jest.fn();
  tree = actCreate(
    <TamaguiTestProvider>
      <PeopleList
        items={[person]}
        loading={false}
        error={null}
        empty="No friends"
        busyAccountId={null}
        onAction={async () => {}}
        onOpenShared={onOpenShared}
      />
    </TamaguiTestProvider>,
  );

  const button = tree.root
    .findAllByProps({ label: 'You & CurrentName' })
    .find((node) => typeof node.props.onPress === 'function');
  TestRenderer.act(() => button!.props.onPress());

  expect(onOpenShared).toHaveBeenCalledWith(accountId);
});

it('disables every friend action while showing progress only on the active account row', () => {
  const otherPerson = {
    ...person,
    account_id: '00000000-0000-4000-8000-000000000003',
    username: 'Other',
    relationship: 'none' as const,
  };
  tree = actCreate(
    <TamaguiTestProvider>
      <PeopleList
        items={[person, otherPerson]}
        loading={false}
        error={null}
        empty="No friends"
        busyAccountId={otherPerson.account_id}
        onAction={async () => {}}
      />
    </TamaguiTestProvider>,
  );

  const rows = tree.root.findAllByProps({ testID: 'friend-actions' });
  expect(rows.map(({ props }) => [props.busy, props.working])).toEqual([
    [true, false],
    [true, true],
  ]);
});

it('keeps pagination disabled during a background list refresh', () => {
  tree = actCreate(
    <TamaguiTestProvider>
      <PeopleList
        items={[person]}
        loading={false}
        fetching
        error={null}
        empty="No friends"
        busyAccountId={null}
        onAction={async () => {}}
        loadMore={jest.fn()}
      />
    </TamaguiTestProvider>,
  );

  const loadMore = tree.root.findByProps({ label: 'Load more' });
  expect(loadMore.props.disabled).toBe(true);
});

it('does not create player entries merely from accepted friendships', () => {
  tree = actCreate(
    <TamaguiTestProvider>
      <PlayerStatsList
        playerStats={[]}
        history={[]}
        socialPeople={[person]}
        onOpenShared={jest.fn()}
      />
    </TamaguiTestProvider>,
  );

  expect(tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Rank '))).toHaveLength(0);
});
