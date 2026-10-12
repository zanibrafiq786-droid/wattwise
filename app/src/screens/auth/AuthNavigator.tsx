import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen } from "./SignUpScreen";
import { WelcomeScreen } from "./WelcomeScreen";

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
