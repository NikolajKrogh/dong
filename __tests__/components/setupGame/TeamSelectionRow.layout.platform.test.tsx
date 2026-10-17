import React from 'react';
import { act } from 'react-test-renderer';
import { actCreate } from '../../../test-utils/render';
import TeamSelectionRow from '../../../components/setupGame/TeamSelectionRow';
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
it('keeps selected names complete and clear controls outside selection controls', () => {
 const homeTeam = 'A very long home team name that must remain readable';
 const tree = actCreate(<TeamSelectionRow homeTeam={homeTeam} awayTeam="Away team" homeTeamOptions={[]} awayTeamOptions={[]} setHomeTeam={jest.fn()} setAwayTeam={jest.fn()} handleAddMatchAndClear={jest.fn()} addNewHomeTeam={jest.fn()} addNewAwayTeam={jest.fn()} />);
 const home = tree.root.findAll((node) => node.props.accessibilityLabel === `Home Team: ${homeTeam}` && node.props.accessibilityRole === 'button')[0];
 expect(home).toBeDefined();
 expect(home.findAll((node) => node !== home && node.props.accessibilityLabel === 'Clear Home Team')).toHaveLength(0);
 const names = tree.root.findAll((node) => node.props.children === homeTeam);
 expect(names.some((node) => node.props.numberOfLines === undefined)).toBe(true);
 expect(tree.root.findAll((node) => node.props.accessibilityLabel === 'Clear Home Team').length).toBeGreaterThan(0);
 act(() => tree.unmount());
});
