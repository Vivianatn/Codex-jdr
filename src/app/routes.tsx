import { Navigate, type RouteObject } from 'react-router'
import { RequirePlayersSession, RequireSession } from '@/features/account/SessionGate'
import { ResumePrep, RouteError, WizardRoute } from './RouteHelpers'
import {
  AdventurerLinkPage,
  CampaignLayout,
  CampaignsPage,
  EntitySheetPage,
  InvitePage,
  MapEditorPage,
  PlayerScreen,
  PlayerView,
  PlayLayout,
  PrepLayout,
  PrepSectionPage,
  ProfilePage,
  ResetPasswordPage,
  SessionEditor,
  TemplateSheetPage,
} from './screens'

export const routes: RouteObject[] = [
  {
    // Every GM screen needs an unlocked account (D-241).
    element: <RequireSession />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <CampaignsPage />, errorElement: <RouteError /> },
      // An invitation link of an online campaign (D-262).
      { path: '/rejoindre/:code', element: <InvitePage />, errorElement: <RouteError /> },
      // Profiles and adventurers (D-267).
      { path: '/profil', element: <ProfilePage />, errorElement: <RouteError /> },
      { path: '/profil/:userId', element: <ProfilePage />, errorElement: <RouteError /> },
      { path: '/aventurier/:code', element: <AdventurerLinkPage />, errorElement: <RouteError /> },
      // A player in someone else's game (D-245).
      { path: '/c/:campaignId/player', element: <PlayerScreen />, errorElement: <RouteError /> },
      {
        path: '/c/:campaignId',
        element: <CampaignLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <ResumePrep /> },
          { path: 'prep', element: <ResumePrep /> },
          {
            path: 'prep/:section',
            element: <PrepLayout />,
            children: [
              { index: true, element: <PrepSectionPage /> },
              { path: 'new', element: <WizardRoute /> },
              { path: 'e/:entityId', element: <EntitySheetPage /> },
              { path: 't/:templateId', element: <TemplateSheetPage /> },
              { path: 'm/:mapId', element: <MapEditorPage /> },
              { path: 's/:sessionId', element: <SessionEditor /> },
            ],
          },
          { path: 'play', element: <PlayLayout /> },
        ],
      },
    ],
  },
  {
    // The players' window is unlocked by the GM window, never by a password typed on the projector.
    path: '/c/:campaignId/view',
    element: <RequirePlayersSession />,
    errorElement: <RouteError />,
    children: [{ index: true, element: <PlayerView /> }],
  },
  {
    // The link of a password-reset e-mail: no local account needs to be open (D-262).
    path: '/reinitialiser/:token',
    element: <ResetPasswordPage />,
    errorElement: <RouteError />,
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
