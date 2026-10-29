import { calculateDrinkBalance } from "../../../features/game-progress/drinkBalance";

const common = { id: "common", homeGoals: 2, awayGoals: 1 };
const assigned = { id: "assigned", homeGoals: 1, awayGoals: 1 };

it("counts the common match once and retains the 1/0.5 weights", () => {
  expect(calculateDrinkBalance([common, assigned], "common", ["common", "assigned", "assigned"], 0))
    .toMatchObject({ required: 4, consumed: 0, remaining: 4, ahead: 0 });
});

it("lowers only the requirement after a correction and shows the exact surplus", () => {
  const before = calculateDrinkBalance([common], "common", [], 4);
  const corrected = calculateDrinkBalance([{ ...common, homeGoals: 1 }], "common", [], 4);
  expect(before).toMatchObject({ required: 3, consumed: 4, label: "1.0 ahead" });
  expect(corrected).toMatchObject({ required: 2, consumed: 4, remaining: 0, label: "2.0 ahead" });
  expect(calculateDrinkBalance([{ ...common, homeGoals: 4 }], "common", [], 4))
    .toMatchObject({ required: 5, consumed: 4, remaining: 1, label: "1.0 more" });
});
