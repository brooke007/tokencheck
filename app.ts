import { Connection } from "@solana/web3.js";
import { checkToken, checkLPBurnedState } from "./index";
import { logger } from "./logger";
import dotenv from "dotenv";

dotenv.config();
const connection = new Connection(process.env.RPC_URL || "");
export async function main() {
  const connection = new Connection(process.env.RPC_URL || "");

  await checkToken("DMjMHJwbd3ubES1L16rGSX5VaGBif9nLefDP5UWEpump", connection);

  await checkLPBurnedState(
    "8pjr6yDpbPPh12KzAFEVm35S5jA7eTnBastejU9qASPr",
    connection
  );
}

if (require.main === module) {
  main().catch((error) => {
    logger.error("An error occurred:", error);
  });
}
