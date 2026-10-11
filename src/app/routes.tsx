import { Navigate, type RouteObject } from 'react-router'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { PlayLayout } from '@/features/play/PlayLayout'
import { PrepLayout } from '@/features/prep/PrepLayout'
import { PrepSectionPage } from '@/features/prep/PrepSectionPage'
import { CampaignLayout } from '@/features/shell/CampaignLayout'
import { ResumePrep, RouteError } from './RouteHelpers'

export const routes: RouteObject[] = [
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
        children: [{ index: true, element: <PrepSectionPage /> }],
      },
      { path: 'play', element: <PlayLayout /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
