import { Navigate, type RouteObject } from 'react-router'
import { RequirePlayersSession, RequireSession } from '@/features/account/SessionGate'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { SessionEditor } from '@/features/sessions/SessionEditor'
import { PlayLayout } from '@/features/play/PlayLayout'
import { PrepLayout } from '@/features/prep/PrepLayout'
import { PrepSectionPage } from '@/features/prep/PrepSectionPage'
import { CampaignLayout } from '@/features/shell/CampaignLayout'
import { EntitySheetPage, TemplateSheetPage } from '@/features/characters/SheetPages'
import {
  MapEditorRoute,
  PlayerViewRoute,
  ResumePrep,
  RouteError,
  WizardRoute,
} from './RouteHelpers'

export const routes: RouteObject[] = [
  {
    // Every GM screen needs an unlocked account (D-241).
    element: <RequireSession />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <CampaignsPage />, errorElement: <RouteError /> },
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
              { path: 'm/:mapId', element: <MapEditorRoute /> },
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
    children: [{ index: true, element: <PlayerViewRoute /> }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
