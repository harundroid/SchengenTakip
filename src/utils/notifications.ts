/**
 * In-App & Local Notification Helper
 * Graceful notification handler without requiring native push notification permissions.
 */

export const requestNotificationPermissions = async (): Promise<boolean> => {
  return true;
};

export const scheduleVisaExpiringNotification = async (
  title: string,
  body: string
): Promise<void> => {
  // In-app banners and status badges on the dashboard already inform the user visually.
};
