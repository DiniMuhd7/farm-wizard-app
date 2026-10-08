import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

const NetworkContext = createContext({
  isConnected: true,
  setIsConnectedManually: () => {}, // Add this
});

export default NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const updateNetworkState = (state) => {
      //console.log("📶 NetInfo state:", state); // 👈 LOG THIS
      setIsConnected(state.isConnected && state.isInternetReachable);
    };

    const unsubscribe = NetInfo.addEventListener(updateNetworkState);
    NetInfo.fetch().then(updateNetworkState);

    return () => unsubscribe();
  }, []);

  const setIsConnectedManually = (status) => {
    setIsConnected(status);
  };

  return (
    <NetworkContext.Provider value={{ isConnected, setIsConnectedManually }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
