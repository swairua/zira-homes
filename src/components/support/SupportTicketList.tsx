import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, AlertCircle } from "lucide-react";
import { SupportTicket } from "@/hooks/useSupportData";
import { formatDistanceToNow } from "date-fns";

interface SupportTicketListProps {
  tickets: SupportTicket[];
  selectedTicket: SupportTicket | null;
  onSelectTicket: (ticket: SupportTicket) => void;
  searchQuery?: string;
  statusFilter?: string;
  priorityFilter?: string;
}

export function SupportTicketList({
  tickets,
  selectedTicket,
  onSelectTicket,
  searchQuery = "",
  statusFilter = "",
  priorityFilter = ""
}: SupportTicketListProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500 text-white';
      case 'in_progress': return 'bg-yellow-500 text-white';
      case 'resolved': return 'bg-green-500 text-white';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (filteredTickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No tickets found</h3>
        <p className="text-muted-foreground">
          {searchQuery || statusFilter || priorityFilter 
            ? "Try adjusting your filters to see more results."
            : "No support tickets have been created yet."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredTickets.map((ticket) => (
        <Card 
          key={ticket.id} 
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedTicket?.id === ticket.id ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onSelectTicket(ticket)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-foreground mb-2">
                  {ticket.title}
                </CardTitle>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getPriorityColor(ticket.priority)}>
                    {ticket.priority.toUpperCase()}
                  </Badge>
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {ticket.category}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {ticket.description}
            </p>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>
                    {ticket.user?.first_name} {ticket.user?.last_name}
                  </span>
                </div>
                {ticket.assigned_to && ticket.assigned_user && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs">Assigned to:</span>
                    <span className="font-medium">
                      {ticket.assigned_user.first_name} {ticket.assigned_user.last_name}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            
            {ticket.messages && ticket.messages.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''} •{' '}
                  Last updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}