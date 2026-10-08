export interface User {
  id: string;
  name: string;
  email: string;
  level: string;
  profileImage?: string;
  preferences: {
    notifications: boolean;
    emailUpdates: boolean;
    darkMode: boolean;
  };
}
