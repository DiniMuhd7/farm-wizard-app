import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import uuid from "react-native-uuid";
import client from "@/config/client";
import { signOut, signInAsGuest } from "@/services/auth";

const LoginContext = createContext();

export const useLoginContext = () => useContext(LoginContext);

const CACHED_USER_KEY = "cachedUser";
const GUEST_DEVICE_ID_KEY = "guest-device-id";
// A placeholder identity used the moment there's no connectivity (or the
// real guest sign-in request fails for any reason), so the app is usable
// immediately instead of stuck waiting on a network call that can't
// complete. It carries no real token — anything that genuinely needs the
// server (call history, numbers, placing an actual call) still correctly
// asks for a connection when it's attempted, exactly as it would for
// anyone offline. This only unblocks the parts of the UI that don't.
const LOCAL_GUEST_KEY = "localGuestUser";

const LoginProvider = ({ children }) => {
  const [isLogged, setIsLogged] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Guards against overlapping reconciliation attempts if connectivity
  // flickers on/off rapidly.
  const reconcilingRef = useRef(false);

  // Persist the user so the session can be restored instantly on next launch,
  // even before (or without) the server confirming the token.
  useEffect(() => {
    if (user && user.email) {
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(
        () => {}
      );
    }
  }, [user]);

  // Starts a real, server-confirmed anonymous session. The same device id is
  // reused across launches (see sign-in.jsx's manual guest button, and the
  // local-guest fallback below, which share it), so this always resolves to
  // the same guest account rather than creating a new throwaway one every
  // time.
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
      await AsyncStorage.removeItem(LOCAL_GUEST_KEY);
      return true;
    }
    return false;
  };

  const loadOrCreateLocalGuest = async () => {
    const existing = await AsyncStorage.getItem(LOCAL_GUEST_KEY);
    if (existing) return JSON.parse(existing);
    const localUser = {
      fullName: "Guest",
      isGuest: true,
      isLocalOnly: true,
      avatar: 0,
    };
    await AsyncStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(localUser));
    return localUser;
  };

  const enterAsLocalGuest = async () => {
    const localUser = await loadOrCreateLocalGuest();
    setUser(localUser);
    setIsLogged(true);
  };

  // Upgrades a local-only guest to a real, server-confirmed one. Called once
  // connectivity is restored (see the NetInfo listener below) and again on
  // every cold start, before ever falling back to local. Silent on failure —
  // the person just keeps using the local guest they already have.
  const reconcileWithServer = async () => {
    if (reconcilingRef.current) return;
    reconcilingRef.current = true;
    try {
      await startGuestSession();
    } catch (error) {
      console.log("Guest reconciliation deferred:", error?.message);
    } finally {
      reconcilingRef.current = false;
    }
  };

  const fetchUser = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("token");

    if (token === null) {
      // No session yet — fresh install, or after a manual sign-out. Check
      // connectivity first rather than waiting out a request that can't
      // succeed: if we're offline, skip straight to the local guest.
      try {
        const netState = await NetInfo.fetch();
        const hasConnectivity = netState.isConnected && netState.isInternetReachable !== false;
        if (hasConnectivity) {
          const started = await startGuestSession();
          if (started) {
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log("Automatic guest sign-in deferred:", error?.message);
      }

      try {
        await enterAsLocalGuest();
        setLoading(false);
        return;
      } catch (error) {
        // AsyncStorage itself failing is the only way to actually land here
        // — genuinely rare, but fall through to a real signed-out state
        // rather than pretend everything's fine.
        console.log("Local guest fallback failed:", error?.message);
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

  // If currently on a local-only guest, upgrade to a real one the moment the
  // device regains connectivity — entirely in the background, no UI
  // interruption, no re-render the person has to wait through.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      if (online && user?.isLocalOnly) {
        reconcileWithServer();
      }
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <LoginContext.Provider
      value={{
        isLogged,
        setIsLogged,
        user,
        setUser,
        loading,
        setLoading,
        // Lets a screen (e.g. app/index.jsx's failure-state retry) re-run
        // the same auto-guest-sign-in logic on demand, instead of ever
        // needing to fall back to a manual login screen.
        refreshSession: fetchUser,
      }}
    >
      {children}
    </LoginContext.Provider>
  );
};

export default LoginProvider;
