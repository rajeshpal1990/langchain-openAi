import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { exec } from "child_process";
import { promisify } from "util";

import fs from "fs";
import path from "path";

// read the JSON file
const filePath = path.resolve("./ucfdata.json");
const ucfDataRaw = fs.readFileSync(filePath, "utf-8");
const ucfData = JSON.parse(ucfDataRaw);

// access lead_info
const ucfLoanData = ucfData.lead_info;


const asyncExecute = promisify(exec); // ✅ this was missing before

/**
 * SUM TOOL
 * Returns sum as STRING
 */
export const sumTool = tool(
  async ({ num1, num2 }) => {
    const result = num1 + num2;
    return `The sum of ${num1} and ${num2} is ${result}.`;
  },
  {
    name: "sum",
    description: "Calculate the sum of two numbers",
    schema: z.object({
      num1: z.number().describe("First number"),
      num2: z.number().describe("Second number"),
    }),
  }
);

/**
 * PRIME CHECK TOOL
 * Returns result as STRING (true/false explanation)
 */
export const primeTool = tool(
  async ({ num }) => {
    if (num < 2) {
      return `${num} is not a prime number because prime numbers are greater than 1.`;
    }
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        return `${num} is not a prime number because it is divisible by ${i}.`;
      }
    }
    return `${num} is a prime number because it has no divisors other than 1 and itself.`;
  },
  {
    name: "prime",
    description: "Check whether a number is prime or not",
    schema: z.object({
      num: z.number().describe("Number to check"),
    }),
  }
);

/**
 * CRYPTO PRICE TOOL
 * Returns human-readable text (NOT JSON)
 */
export const cryptoTool = tool(
  async ({ coin }) => {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}`
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        return `Crypto currency "${coin}" was not found.`;
      }

      const c = data[0];

      return `
Crypto Name: ${c.name}
Symbol: ${c.symbol.toUpperCase()}
Current Price (USD): $${c.current_price}
Market Cap: $${c.market_cap}
24h Change: ${c.price_change_percentage_24h}%
      `.trim();
    } catch (error) {
      return "Failed to fetch crypto price. Please try again later.";
    }
  },
  {
    name: "getCryptoPrice",
    description: "Get current market price of a crypto currency",
    schema: z.object({
      coin: z.string().describe("Crypto currency name like bitcoin, ethereum"),
    }),
  }
);


/**
 * Execute Shell/Terminal Command
 */
export const executeCommandTool = tool(
  async ({ command }) => {
    try {
      const { stdout, stderr } = await asyncExecute(command);
      if (stderr) return `Error: ${stderr}`;
      return `Success: ${stdout || "Task executed successfully"}`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  },
  {
    name: "executeCommand",
    description:
      "Execute a terminal command. Can create folder, files, write, edit, or delete files.",
    schema: z.object({
      command: z.string().describe('Single terminal command, e.g., "mkdir calculator"'),
    }),
  }
);

/**
 * tools for UCF Application stattic data 
 */

export const ucfApplicationTool = tool(
  async ({ query }) => {
    try {
      let result = [];

      // check if query has a keyword
      const [keyword, ...rest] = query.split(":");
      const value = rest.join(":").trim();

      if (keyword && value) {
        switch (keyword.toLowerCase()) {
          case "loan_code":
            result = ucfLoanData.filter((loan) => loan.lead_code === value);
            break;
          case "customer":
            result = ucfLoanData.filter((loan) =>
              loan.customer.name.toLowerCase().includes(value.toLowerCase())
            );
            break;
          case "mmv":
            result = ucfLoanData.filter((loan) =>
              loan.carinfo.mmv_name.toLowerCase().includes(value.toLowerCase())
            );
            break;
          default:
            // fallback: search in all fields
            result = ucfLoanData.filter(
              (loan) =>
                loan.lead_code === query ||
                loan.customer.name.toLowerCase().includes(query.toLowerCase()) ||
                loan.carinfo.mmv_name.toLowerCase().includes(query.toLowerCase()) ||
                loan.financier.name.toLowerCase().includes(query.toLowerCase())
            );
        }
      } else {
        // if no keyword, search in all fields
        result = ucfLoanData.filter(
          (loan) =>
            loan.lead_code === query ||
            loan.customer.name.toLowerCase().includes(query.toLowerCase()) ||
            loan.carinfo.mmv_name.toLowerCase().includes(query.toLowerCase()) ||
            loan.financier.name.toLowerCase().includes(query.toLowerCase())
        );
      }

      return result.length ? result : "No matching loans found.";
    } catch (error) {
      console.error(error);
      return "Failed to fetch UCF loan data. Please try again later.";
    }
  },
  {
    name: "getucfLoanData",
    description:
      "Get the loan data from UCF Application based on loan_code, customer, mmv, or financier",
    schema: z.object({
      query: z.string().describe(
        "Search format: 'loan_code:123', 'customer:Rajesh', 'mmv:Creta', 'financier:BCA' or just a plain search"
      ),
    }),
  }
);




/**
 * EXPORT ALL TOOLS
 */
export const tools = [sumTool, primeTool, cryptoTool,ucfApplicationTool];
