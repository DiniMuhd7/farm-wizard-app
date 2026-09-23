import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "@/config/client";

export const signUpUser = async (
  fullName,
  email,
  password,
  selectedLanguage,
  selectedCountry,
  selectedIndex
) => {
  try {
    const response = await client.post(
      "/auth/register",
      {
        fullName,
        email,
        password,
        country: selectedCountry,
        language: selectedLanguage,
        avatar: selectedIndex,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // registerUser's response is { success, message, data: { user, token } }
    // (goodResponse's shape) — the token lives at response.data.data.token,
    // not response.data.token. It was also never actually stored (the
    // AsyncStorage call was commented out), which meant every newly
    // registered account was forced straight back to a manual sign-in
    // immediately after registering, even though the backend had already
    // issued a perfectly good session.
    if (response.status === 200 && response.data?.success) {
      const token = response.data?.data?.token;
      if (token) await AsyncStorage.setItem("token", token);
    }
    return response;
  } catch (error) {
    console.log("Error inside singup method", error.message);
    throw error;
  }
};

export const signInUser = async (email, password) => {
  try {
    const response = await client.post(
      "/auth/login",
      {
        email,
        password,
      },
      {
        headers: {
          // Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.success === true) {
      const token = response.data.data.token;
      await AsyncStorage.setItem("token", token);
    }

    return response;
  } catch (error) {
    console.log("Error inside singin method", error.message);
    throw error;
  }
};

export const signInAsGuest = async (deviceId, deviceName) => {
  const response = await client.post(
    "/auth/guest",
    { deviceId, deviceName },
    { headers: { "Content-Type": "application/json" } }
  );

  if (response.data?.success && response.data?.data?.token) {
    await AsyncStorage.setItem("token", response.data.data.token);
  }

  return response;
};

export const signOut = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token !== null) {
      // Best-effort server sign-out; don't block local logout on it.
      try {
        await client.get("/auth/sign-out", {
          headers: {
            Authorization: `JWT ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (e) {
        // server unreachable — still clear the local session below
      }
    }
    // Always clear the local session so logout works even when offline.
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("cachedUser");
    return true;
  } catch (error) {
    console.log("Error inside signout method", error.message);
    return false;
  }
};

export const forgetPassword = async (email) => {
  try {
    const response = await client.post(
      "/auth/forget-password",
      {
        email,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error) {
    console.log("Error inside forget password method", error.message);
  }
};
export const verifyOTP = async (email, code) => {
  try {
    const response = await client.post(
      "/auth/verify-otp",
      {
        email,
        code,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error) {
    console.log("Error inside verify otp method", error.message);
  }
};

export const resetPassword = async (email, code, password) => {
  try {
    const response = await client.post(
      "/auth/reset-password",
      {
        email,
        code,
        newPassword: password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error) {
    console.log("Error inside reset password method", error.message);
  }
};
