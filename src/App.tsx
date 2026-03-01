import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Screen } from './types';
import BookingToast from './components/BookingToast';
import { sendPushNotification } from './hooks/usePushNotifications';

interface EditMealData {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: 'food_rescue' | 'homemade_meal';
  slots_total: number;
  allergens: string[];
  meal_date: string | null;
  expires_at: string | null;
  quantity: string | null;
  location_lat: number;
  location_lng: number;
  location_name: string;
}

const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const MapScreen = lazy(() => import('./screens/MapScreen'));
const ExploreScreen = lazy(() => import('./screens/ExploreScreen'));
const CreateMealScreen = lazy(() => import('./screens/CreateMealScreen'));
const MessagesScreen = lazy(() => import('./screens/MessagesScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const CulinaryScreen = lazy(() => import('./screens/CulinaryScreen'));
const OnboardingScreen = lazy(() => import('./components/OnboardingScreen'));

interface PendingToast {
  id: string;
  guestName: string;
  mealTitle: string;
}

function ScreenLoader() {
  return (
    <div className="w-full flex items-center justify-center h-app">
      <div className="w-8 h-8 rounded-full border-2 border-[#49e619] border-t-transparent animate-spin" />
    </div>
  );
}

function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>('map');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editMeal, setEditMeal] = useState<EditMealData | null>(null);
  const [openConversationId, setOpenConversationId] = useState<string | null>(null);
  const [culinaryInitialTab, setCulinaryInitialTab] = useState<'feed' | 'challenges' | null>(null);

  const [unreadBookings, setUnreadBookings] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [toastQueue, setToastQueue] = useState<PendingToast[]>([]);
  const userIdRef = useRef<string | null>(null);
  const screenRef = useRef<Screen>('map');
  const activeConvIdRef = useRef<string | null>(null);
  const loadUnreadMessagesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        userIdRef.current = session.user.id;
        checkOnboarding(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setScreen('map');
        setShowOnboarding(false);
        userIdRef.current = null;
      } else {
        userIdRef.current = session.user.id;
        checkOnboarding(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    async function loadUnseenCount() {
      try {
        const { data: hostMeals, error } = await supabase
          .from('meals')
          .select('id')
          .eq('host_id', userId);

        if (error || !hostMeals || hostMeals.length === 0) return;

        const mealIds = hostMeals.map((m: { id: string }) => m.id);

        const { count, error: countError } = await supabase
          .from('meal_participants')
          .select('id', { count: 'exact', head: true })
          .in('meal_id', mealIds)
          .eq('seen_by_host', false)
          .eq('no_show', false);

        if (!countError && count && count > 0) setUnreadBookings(count);
      } catch { /* non-critical, ignore */ }
    }

    loadUnseenCount();

    async function loadUnreadMessages() {
      try {
        const { data: deletedConvs } = await supabase
          .from('deleted_conversations')
          .select('conversation_id')
          .eq('user_id', userId);

        const deletedIds = (deletedConvs ?? []).map((d: { conversation_id: string }) => d.conversation_id);

        let query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', userId)
          .is('read_at', null);

        if (deletedIds.length > 0) {
          query = query.not('conversation_id', 'in', `(${deletedIds.join(',')})`);
        }

        const { count } = await query;
        setUnreadMessages(count ?? 0);
      } catch { /* non-critical, ignore */ }
    }

    loadUnreadMessages();
    loadUnreadMessagesRef.current = loadUnreadMessages;

    const msgChannel = supabase
      .channel(`unread-messages:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const msg = payload.new as { conversation_id: string | null };
          if (activeConvIdRef.current && msg.conversation_id === activeConvIdRef.current) return;
          setUnreadMessages((prev) => prev + 1);
        }
      )
      .subscribe();

    const channel = supabase
      .channel(`host-bookings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meal_participants',
        },
        async (payload) => {
          try {
            const participant = payload.new as {
              meal_id: string;
              user_id: string;
            };

            const [mealResult, guestResult] = await Promise.all([
              supabase
                .from('meals')
                .select('id, title, host_id')
                .eq('id', participant.meal_id)
                .maybeSingle(),
              supabase
                .from('profiles')
                .select('name')
                .eq('id', participant.user_id)
                .maybeSingle(),
            ]);

            const mealData = mealResult.data;
            if (!mealData || mealData.host_id !== userId) return;

            const guestProfile = guestResult.data;
            const guestName = (guestProfile as { name?: string } | null)?.name ?? 'Quelqu\'un';
            const mealTitle = (mealData as { title?: string } | null)?.title ?? 'ton repas';

            setUnreadBookings((prev) => {
              return screenRef.current !== 'messages' ? prev + 1 : prev;
            });

            setToastQueue((prev) => [
              ...prev,
              { id: `${participant.meal_id}-${participant.user_id}-${Date.now()}`, guestName, mealTitle },
            ]);

            sendPushNotification({
              user_id: userId,
              title: `${guestName} a réservé !`,
              body: `Nouvelle réservation pour "${mealTitle}"`,
              tag: `booking-${participant.meal_id}`,
              data: { screen: 'messages' },
            });
          } catch {
            // silently ignore errors in realtime handler
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
    };
  }, [session]);

  const markBookingsSeen = useCallback(async (userId: string) => {
    const { data: hostMeals } = await supabase
      .from('meals')
      .select('id')
      .eq('host_id', userId);

    if (!hostMeals || hostMeals.length === 0) return;

    const mealIds = hostMeals.map((m: { id: string }) => m.id);

    await supabase
      .from('meal_participants')
      .update({ seen_by_host: true })
      .in('meal_id', mealIds)
      .eq('seen_by_host', false);
  }, []);

  const handleNavigate = useCallback((s: Screen) => {
    if (s === 'messages' && userIdRef.current) {
      setUnreadBookings(0);
      markBookingsSeen(userIdRef.current);
      loadUnreadMessagesRef.current?.();
    }
    if (s !== 'messages') {
      activeConvIdRef.current = null;
    }
    setScreen(s);
  }, [markBookingsSeen]);

  const handleContactMember = useCallback(async (hostId: string, _hostName: string, _hostAvatar: string) => {
    const uid = userIdRef.current;
    if (!uid || !hostId) return;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .is('meal_id', null)
      .or(
        `and(host_id.eq.${hostId},guest_id.eq.${uid}),and(host_id.eq.${uid},guest_id.eq.${hostId})`
      )
      .maybeSingle();

    if (existing?.id) {
      setOpenConversationId(existing.id);
      handleNavigate('messages');
      return;
    }

    const introMsg = 'Bonjour ! Je t\'ai trouvé dans le Cercle Culinaire et j\'aimerais qu\'on s\'invite à partager un repas.';

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ meal_id: null, host_id: hostId, guest_id: uid, last_message_text: introMsg, last_message_at: new Date().toISOString() })
      .select('id')
      .maybeSingle();

    if (newConv?.id) {
      await supabase.from('messages').insert({
        sender_id: uid,
        receiver_id: hostId,
        meal_id: null,
        content: introMsg,
        conversation_id: newConv.id,
      });

      setOpenConversationId(newConv.id);
      handleNavigate('messages');
    }
  }, [handleNavigate]);

  const handleConvOpen = useCallback((convId: string | null) => {
    activeConvIdRef.current = convId;
    loadUnreadMessagesRef.current?.();
    if (convId) setOpenConversationId(null);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const data = event.data.data as { screen?: string };
        if (data?.screen === 'messages') handleNavigate('messages');
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [handleNavigate]);

  async function checkOnboarding(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', userId)
      .maybeSingle();
    if (data && !data.onboarding_done) setShowOnboarding(true);
  }

  if (session === undefined) {
    return <ScreenLoader />;
  }

  if (!session) {
    return (
      <div className="w-full h-app">
        <Suspense fallback={<ScreenLoader />}>
          <LoginScreen />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden h-app">
      <Suspense fallback={<ScreenLoader />}>
        {screen === 'map' && (
          <MapScreen
            activeScreen={screen}
            onNavigate={handleNavigate}
            unreadBookings={unreadBookings + unreadMessages}
            onNavigateToChallenges={() => {
              setCulinaryInitialTab('challenges');
              handleNavigate('culinary');
            }}
          />
        )}
        {screen === 'explore' && (
          <ExploreScreen
            activeScreen={screen}
            onNavigate={handleNavigate}
            unreadBookings={unreadBookings + unreadMessages}
            onContactMember={handleContactMember}
            onNavigateToChallenges={() => {
              setCulinaryInitialTab('challenges');
              handleNavigate('culinary');
            }}
            onEditMeal={(meal) => {
              setEditMeal({
                id: meal.id,
                title: meal.title,
                description: meal.description,
                image_url: meal.image_url,
                category: meal.category === 'food_rescue' ? 'food_rescue' : 'homemade_meal',
                slots_total: meal.slots_total,
                allergens: meal.allergens ?? [],
                meal_date: meal.meal_date ?? null,
                expires_at: meal.expires_at ?? null,
                quantity: meal.quantity ?? null,
                location_lat: meal.location_lat,
                location_lng: meal.location_lng,
                location_name: meal.location_name,
              });
              handleNavigate('create');
            }}
          />
        )}
        {screen === 'create' && (
          <CreateMealScreen
            onNavigate={(s) => {
              setEditMeal(null);
              handleNavigate(s);
            }}
            editMeal={editMeal}
          />
        )}
        {screen === 'messages' && (
          <MessagesScreen
            activeScreen={screen}
            onNavigate={handleNavigate}
            unreadBookings={unreadBookings + unreadMessages}
            unreadMessages={unreadMessages}
            onConvOpen={handleConvOpen}
            openConversationId={openConversationId}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            activeScreen={screen}
            onNavigate={handleNavigate}
            unreadBookings={unreadBookings + unreadMessages}
            onNotificationsOpen={() => {
              if (userIdRef.current) {
                setUnreadBookings(0);
                markBookingsSeen(userIdRef.current);
              }
            }}
            onEditMeal={(meal) => {
              setEditMeal(meal as EditMealData);
              handleNavigate('create');
            }}
          />
        )}
        {screen === 'culinary' && (
          <CulinaryScreen
            activeScreen={screen}
            onNavigate={handleNavigate}
            unreadBookings={unreadBookings + unreadMessages}
            onContactMember={handleContactMember}
            initialTab={culinaryInitialTab ?? undefined}
            onInitialTabConsumed={() => setCulinaryInitialTab(null)}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen onBack={() => setScreen('profile')} onNavigate={handleNavigate} />
        )}

        {showOnboarding && (
          <OnboardingScreen onDone={() => setShowOnboarding(false)} />
        )}
      </Suspense>

      {toastQueue.length > 0 && (
        <BookingToast
          key={toastQueue[0].id}
          guestName={toastQueue[0].guestName}
          mealTitle={toastQueue[0].mealTitle}
          onClose={() => setToastQueue((prev) => prev.slice(1))}
          onViewMessages={() => handleNavigate('messages')}
        />
      )}
    </div>
  );
}
