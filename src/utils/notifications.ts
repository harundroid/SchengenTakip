let Notifications: any;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  // Graceful fallback if module loading
}

export const requestNotificationPermissions = async () => {
  try {
    if (!Notifications) return false;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('Could not request notification permissions:', error);
    return false;
  }
};

export const scheduleVisaExpiringNotification = async (
  title: string,
  body: string
) => {
  try {
    if (!Notifications) return;
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Cancel existing scheduled notifications to prevent duplicate alerts
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Trigger local notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null, // Triggers immediately
    });
  } catch (error) {
    console.warn('Could not schedule visa expiring notification:', error);
  }
};
