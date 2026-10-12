import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen } from "./SignUpScreen";

export type AuthStackParamList = {
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Facebook-style: the app opens directly to the login page (SignInScreen),
// not a separate "Sign up or sign in?" chooser -- "Create New Account" is a
// button at the bottom of the login page itself. The old WelcomeScreen that
// used to be the initial route is removed (it had become unreachable).
export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="SignIn" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
