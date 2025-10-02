import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, UserPlus, Settings, UserX, Shield, Users } from "lucide-react";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useForm } from "react-hook-form";
import { useSubUsers } from "@/hooks/useSubUsers";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";

interface CreateSubUserFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
}

const SubUserManagement = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedSubUser, setSelectedSubUser] = useState<any>(null);
  const { subUsers, loading, createSubUser, updateSubUserPermissions, deactivateSubUser } = useSubUsers();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateSubUserFormData>({
    defaultValues: {
      permissions: {
        manage_properties: false,
        manage_tenants: false,
        manage_leases: false,
        manage_maintenance: false,
        view_reports: true,
      }
    }
  });

  const permissions = watch('permissions');

  const onCreateSubUser = async (data: CreateSubUserFormData) => {
    try {
      await createSubUser(data);
      setCreateDialogOpen(false);
      reset();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handlePermissionChange = (permission: keyof CreateSubUserFormData['permissions'], value: boolean) => {
    setValue(`permissions.${permission}`, value);
  };

  const openPermissionsDialog = (subUser: any) => {
    setSelectedSubUser(subUser);
    setPermissionsDialogOpen(true);
  };

  const handleUpdatePermissions = async (newPermissions: any) => {
    if (!selectedSubUser) return;
    
    try {
      await updateSubUserPermissions(selectedSubUser.id, newPermissions);
      setPermissionsDialogOpen(false);
      setSelectedSubUser(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeactivateSubUser = async (subUserId: string) => {
    try {
      await deactivateSubUser(subUserId);
    } catch (error) {
      // Error handled in hook
    }
  };

  const getPermissionCount = (perms: any) => {
    return Object.values(perms).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">Sub-User Management</h2>
          <p className="text-muted-foreground">
            Delegate access to trusted partners, managers, and agents
          </p>
        </div>
        <DisabledActionWrapper 
          feature={FEATURES.SUB_USERS}
          fallbackTitle="Create Sub-Users"
          fallbackDescription="Add team members with custom permissions and role-based access control."
        >
          <Button className="bg-accent hover:bg-accent/90 w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sub-User
          </Button>
        </DisabledActionWrapper>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-tint-gray">
          <DialogHeader>
            <DialogTitle className="text-primary">Create New Sub-User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubUser)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-primary">First Name *</Label>
                <Input
                  id="first_name"
                  className="border-border bg-card"
                  {...register("first_name", { required: "First name is required" })}
                  placeholder="John"
                />
                {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-primary">Last Name *</Label>
                <Input
                  id="last_name"
                  className="border-border bg-card"
                  {...register("last_name", { required: "Last name is required" })}
                  placeholder="Doe"
                />
                {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-primary">Email *</Label>
              <Input
                id="email"
                type="email"
                className="border-border bg-card"
                {...register("email", { required: "Email is required" })}
                placeholder="john.doe@example.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              <p className="text-xs text-muted-foreground">
                If this email exists, we'll reset their password and link them to your organization. You'll receive new credentials to share with them.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-primary">Phone</Label>
                <Input
                  id="phone"
                  className="border-border bg-card"
                  {...register("phone")}
                  placeholder="+254 700 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-primary">Title</Label>
                <Input
                  id="title"
                  className="border-border bg-card"
                  {...register("title")}
                  placeholder="Manager, Agent, Partner"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-primary font-semibold">Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => handlePermissionChange(key as keyof CreateSubUserFormData['permissions'], checked)}
                    />
                    <Label htmlFor={key} className="text-sm capitalize">
                      {key.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:w-auto bg-accent hover:bg-accent/90"
              >
                Create Sub-User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Sub-Users</CardTitle>
            <div className="icon-bg-white">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{subUsers.length}</div>
            <p className="text-xs text-white/80">Active sub-users</p>
          </CardContent>
        </Card>
        
        <Card className="card-gradient-green hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">With Management Access</CardTitle>
            <div className="icon-bg-white">
              <Shield className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {subUsers.filter(su => su.permissions.manage_properties || su.permissions.manage_tenants).length}
            </div>
            <p className="text-xs text-white/80">Can manage data</p>
          </CardContent>
        </Card>

        <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">View-Only Access</CardTitle>
            <div className="icon-bg-white">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {subUsers.filter(su => !su.permissions.manage_properties && !su.permissions.manage_tenants && su.permissions.view_reports).length}
            </div>
            <p className="text-xs text-white/80">Read-only access</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Users Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-primary">Sub-Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      Loading sub-users...
                    </TableCell>
                  </TableRow>
                ) : subUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      No sub-users found. Create your first sub-user to delegate access.
                    </TableCell>
                  </TableRow>
                ) : (
                  subUsers.slice(offset, offset + pageSize).map((subUser) => (
                    <TableRow key={subUser.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {subUser.profiles?.first_name} {subUser.profiles?.last_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{subUser.profiles?.email}</TableCell>
                      <TableCell>{subUser.title || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {getPermissionCount(subUser.permissions)} permissions
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {subUser.created_at ? new Date(subUser.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissionsDialog(subUser)}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <UserX className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Sub-User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to deactivate this sub-user? They will lose access to your organization.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeactivateSubUser(subUser.id)}>
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            <TablePaginator
              currentPage={page}
              totalPages={Math.ceil(subUsers.length / pageSize)}
              pageSize={pageSize}
              totalItems={subUsers.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              showPageSizeSelector={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      {selectedSubUser && (
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-[400px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-primary">
                Update Permissions - {selectedSubUser.profiles?.first_name} {selectedSubUser.profiles?.last_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {Object.entries(selectedSubUser.permissions).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm capitalize">
                    {key.replace('_', ' ')}
                  </Label>
                  <Switch
                    checked={value as boolean}
                    onCheckedChange={(checked) => {
                      const updatedPermissions = {
                        ...selectedSubUser.permissions,
                        [key]: checked
                      };
                      setSelectedSubUser({
                        ...selectedSubUser,
                        permissions: updatedPermissions
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPermissionsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleUpdatePermissions(selectedSubUser.permissions)}
                className="bg-accent hover:bg-accent/90"
              >
                Update Permissions
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SubUserManagement;