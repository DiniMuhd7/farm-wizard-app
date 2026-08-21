import client from "@/config/client";

export const submitWithdrawal = async (
  amount: number,
  destination: string,
  provider: string,
  withdrawType: string,
  reference: string,
  network: string,
  token: string
) => {
  try {
    const response = await client.post(
      "/withdrawal/request",
      {
        amount,
        destination,
        provider,
        withdrawType,
        reference,
        network,
      },
      {
        headers: {
          Authorization: `JWT ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error: any) {
    console.log("Error inside withdrawal method", error.message);
    throw error;
  }
};

export const fetchWithdrawals = async (token: string) => {
  try {
    const response = await client.get("/withdrawal/user-withdrawals", {
      headers: {
        Authorization: `JWT ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response;
  } catch (error: any) {
    console.log("Error inside withdrawal method", error.message);
    throw error;
  }
};

// Backward-compatible alias for existing imports.
export const submitWithdrwal = submitWithdrawal;
