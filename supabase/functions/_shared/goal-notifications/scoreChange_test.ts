import { goalScoreMessage } from './scoreChange.ts';

Deno.test('score alerts name the scoring side only for an unambiguous single increase', () => {
  const evidence = { homeName: 'Home', awayName: 'Away', previousHomeScore: 0, previousAwayScore: 0, homeScore: 1, awayScore: 0 };
  const single = goalScoreMessage(evidence);
  if (single?.title !== 'Goal for Home' || single.body !== 'Home 1–0 Away') throw new Error('Unexpected single goal message');
  if (goalScoreMessage({ ...evidence, awayScore: 1 })?.title !== 'Score update') throw new Error('Ambiguous score claimed a goal');
  if (goalScoreMessage({ ...evidence, homeScore: 2 })?.title !== 'Score update') throw new Error('Multi-goal increase claimed a single scorer');
  if (goalScoreMessage({ ...evidence, previousHomeScore: 2 }) !== null) throw new Error('Correction created an alert');
});
