import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HelpCircle, PlayCircle } from 'lucide-react';
import { useTour } from '@/hooks/useTour';
import { useLocation } from 'react-router-dom';

interface TourOption {
  id: string;
  name: string;
  page: string;
  description: string;
}

const AVAILABLE_TOURS: TourOption[] = [
  {
    id: 'add_property_tour',
    name: 'Add Property',
    page: '/properties',
    description: 'Learn how to add and manage properties'
  },
  {
    id: 'add_tenant_tour',
    name: 'Add Tenant',
    page: '/tenants',
    description: 'Learn how to invite and manage tenants'
  },
  {
    id: 'generate_report_tour',
    name: 'Generate Reports',
    page: '/reports',
    description: 'Learn how to create financial reports'
  },
  {
    id: 'bulk_upload_tour',
    name: 'Bulk Upload',
    page: '/units',
    description: 'Learn how to bulk upload units and tenants'
  },
  {
    id: 'payment_settings_tour',
    name: 'Payment Settings',
    page: '/landlord/payment-settings',
    description: 'Configure payment methods for your tenants'
  }
];

export function TourLauncher() {
  const { startTour, loading } = useTour();
  const location = useLocation();

  const currentPageTours = AVAILABLE_TOURS.filter(
    tour => tour.page === location.pathname
  );

  const otherTours = AVAILABLE_TOURS.filter(
    tour => tour.page !== location.pathname
  );

  const handleTourStart = (tourId: string) => {
    startTour(tourId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-6 h-12 w-12 rounded-full shadow-lg z-40 hover:scale-105 transition-transform"
          title="Interactive Tours"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Interactive Tours</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {currentPageTours.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Tours for this page
            </div>
            {currentPageTours.map(tour => (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleTourStart(tour.id)}
                disabled={loading}
                className="flex items-start gap-3 py-3 cursor-pointer"
              >
                <PlayCircle className="h-4 w-4 mt-0.5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{tour.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tour.description}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {otherTours.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Other tours
            </div>
            {otherTours.map(tour => (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleTourStart(tour.id)}
                disabled={loading}
                className="flex items-start gap-3 py-2 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{tour.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Available on {tour.page}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
