import csv from "csv-parser";
import fs from "fs";

const STARTING_SOC = 0.8,
  BATTERY_CAPACITY = 100,
  EFFICIENCY_LOSS = 0.9;

type UnitOfPower = {
  time: number;
  power: number;
  soc: number;
};
type PowerUsageInput = Pick<UnitOfPower, "time" | "power">;

// Read from input file and store rows into array for processing
const powerOverTimeRows: Array<PowerUsageInput> = [];
fs.createReadStream("power_over_time.csv")
  .pipe(csv())
  .on("data", (row) =>
    powerOverTimeRows.push({
      time: row["Time"],
      power: parseInt(row["Power"]),
    })
  )
  .on("close", () => main());

function calculateSoc(hour: number, power: number, currentSoc: number): number {
  // If no power is requested/provisioned, we know the state of charge will remain unchanged.
  if (power === 0) return currentSoc;
  // True if negative power (charging), false if positive power (discharging)
  const isPowerCharging = power < 0;
  return isPowerCharging
    ? calculateChargingSoc(power, currentSoc)
    : calculateDischargeSoc(power, currentSoc);
}

function calculateChargingSoc(power: number, currentSoc: number): number {
  // Due to efficiency, we read a number higher than what is being charged in the battery, converted to KWh
  const powerCharged = power * 0.5 * EFFICIENCY_LOSS;
  // Convert SoC into terms of KWh
  const currentKilowattHoursInBattery = currentSoc * BATTERY_CAPACITY;
  // Add the KWhs being charged to the battery
  const kilowattHoursInBatteryAfterCharge =
    currentKilowattHoursInBattery + Math.abs(powerCharged);
  return kilowattHoursInBatteryAfterCharge / BATTERY_CAPACITY;
}

function calculateDischargeSoc(power: number, currentSoc: number): number {
  // Due to efficiency, we read a number lower than what is discharged, converted to KWh
  const powerDischarged = (power * 0.5) / EFFICIENCY_LOSS;
  // Convert SoC into terms of KWh
  const currentKilowattHoursInBattery = currentSoc * BATTERY_CAPACITY;
  // Subtract the KWhs discharged from the battery
  const kilowattHoursInBatteryAfterDischarge =
    currentKilowattHoursInBattery - powerDischarged;
  return kilowattHoursInBatteryAfterDischarge / BATTERY_CAPACITY;
}

function main() {
  let soc: number = STARTING_SOC;
  console.log("Time,Power,SOC");
  powerOverTimeRows.forEach((row) => {
    soc = calculateSoc(row.time, row.power, soc);
    console.log(`${row.time},${row.power},${soc.toFixed(2)}`);
  });
}
