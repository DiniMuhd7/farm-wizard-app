import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import uuid from "react-native-uuid";
import client from "@/config/client";
import { signOut, signInAsGuest } from "@/services/auth";

const LoginContext = createContext();

export const useLoginContext = () => useContext(LoginContext);

const CACHED_USER_KEY = "cachedUser";
const GUEST_DEVICE_ID_KEY = "guest-device-id";

const LoginProvider = ({ children }) => {
  const [isLogged, setIsLogged] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Persist the user so the session can be restored instantly on next launch,
  // even before (or without) the server confirming the token.
  useEffect(() => {
    if (user && user.email) {
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(
        () => {}
      );
    }
  }, [user]);

  // Starts an anonymous session automatically so nobody has to tap through
  // a login screen to use the dialer. The same device id is reused across
  // launches (see sign-in.jsx's manual guest button, which shares it), so
  // this always resolves to the same guest account rather than creating a
  // new throwaway one every cold start.
  const startGuestSession = async () => {
    let deviceId = await AsyncStorage.getItem(GUEST_DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = String(uuid.v4());
      await AsyncStorage.setItem(GUEST_DEVICE_ID_KEY, deviceId);
    }
    const deviceName = (Constants.deviceName || "9tel").slice(0, 24);
    const result = await signInAsGuest(deviceId, deviceName);
    if (result?.data?.success && result.data?.data?.user) {
      setUser(result.data.data.user);
      setIsLogged(true);
      return true;
    }
    return false;
  };

  const fetchUser = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("token");

    if (token === null) {
      // No session yet — fresh install, or after a manual sign-out. Rather
      // than stopping at a login screen, sign in as a guest automatically;
      // a real account is only needed later, for things a guest shouldn't
      // do unsupervised (e.g. provisioning a number — see settings.tsx).
      try {
        const started = await startGuestSession();
        if (started) {
          setLoading(false);
          return;
        }
      } catch (error) {
        // No network, backend unreachable, etc. — fall through to the
        // signed-out state below so the app still has something to show
        // rather than hanging on a blank screen.
        console.log("Automatic guest sign-in deferred:", error?.message);
      }
      setUser({});
      setIsLogged(false);
      setLoading(false);
      return;
    }

    // Optimistically restore the last known session so the user stays signed
    // in across restarts and slow/offline starts.
    try {
      const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
        setIsLogged(true);
      }
    } catch (e) {
      // ignore cache parse errors
    }
    setLoading(false);

    // Validate / refresh against the server in the background.
    try {
      const res = await client.get("/user/user", {
        headers: {
          Authorization: `JWT ${token}`,
        },
      });

      if (res.data.success) {
        setUser(res.data.user);
        setIsLogged(true);
      } else {
        // Token explicitly rejected — sign out for real.
        await signOut();
        await AsyncStorage.removeItem(CACHED_USER_KEY);
        setUser({});
        setIsLogged(false);
      }
    } catch (error) {
      // Network/server error: keep the user signed in with the cached session
      // instead of forcing a re-login.
      console.log("Session validation deferred:", error?.message);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <LoginContext.Provider
      value={{
        isLogged,
        setIsLogged,
        user,
        setUser,
        loading,
        setLoading,
      }}
    >
      {children}
    </LoginContext.Provider>
  );
};

export default LoginProvider;
