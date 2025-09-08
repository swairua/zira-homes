import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'payment' | 'lease' | 'maintenance' | 'system' | 'support';
  read: boolean;
  created_at: string;
  related_id?: string;
  related_type?: string;
}

interface NotificationFilters {
  types?: string[];
  limit?: number;
  unreadOnly?: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (filters: NotificationFilters = {}) => {
    if (!user) return;

    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filters.types && filters.types.length > 0) {
        query = query.in("type", filters.types);
      }

      if (filters.unreadOnly) {
        query = query.eq("read", false);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        type: item.type as Notification["type"]
      })) as Notification[];
      
      setNotifications(typedData);
      updateUnreadCount(typedData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateUnreadCount = useCallback((notificationList: Notification[]) => {
    const unread = notificationList.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert optimistic update
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Revert optimistic update
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const getNotificationTargetUrl = useCallback((notification: Notification): string => {
    switch (notification.related_type) {
      case 'payment':
        return '/payments';
      case 'invoice':
        return '/invoices';
      case 'lease':
        return '/leases';
      case 'maintenance_request':
        return '/maintenance';
      case 'support_ticket':
        return '/support';
      default:
        return '/notifications';
    }
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Add to notifications list
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new unread notifications
          if (!newNotification.read) {
            toast.info(newNotification.title, {
              description: newNotification.message,
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = getNotificationTargetUrl(newNotification);
                }
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev => 
            prev.map(n => 
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );
          
          // Update unread count
          setNotifications(currentNotifications => {
            updateUnreadCount(currentNotifications);
            return currentNotifications;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, getNotificationTargetUrl, updateUnreadCount]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getNotificationTargetUrl
  };
}