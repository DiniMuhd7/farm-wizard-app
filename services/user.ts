import client from "@/config/client";

export const updateUser = async (
  token: string,
  fullName: string,
  password: string,
  selectedIndex: string
) => {
  try {
    const res = await client.patch(
      `/user/update`,
      { fullName, newPassword: password, avatar: selectedIndex },
      {
        headers: {
          Authorization: `JWT ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  } catch (error: any) {
    console.error("PATCH Error:", error?.response?.data);
    throw error;
  }
};

export const deleteUser = async (token: string, email: string) => {
  try {
    const response = await client.get(`/user/delete/${email}`, {
      headers: {
        Authorization: `JWT ${token}`,
        "Content-Type": "application/json",
      },
    });
    return response;
  } catch (error: any) {
    console.log("Error inside deleteuser method", error.message);
    throw error;
  }
};
