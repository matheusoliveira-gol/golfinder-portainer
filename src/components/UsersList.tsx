import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { profilesAPI, userRolesAPI, generateUUID, Profile, UserRole } from "@/lib/api";

interface UserWithRole {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string | null;
  created_at: string;
  role_id?: string;
  role?: string;
}

const UsersList = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const profiles = await profilesAPI.getAll();
      const roles = await userRolesAPI.getAll();

      const usersWithRoles = profiles.map((profile: Profile) => {
        const userRole = roles.find((role: UserRole) => role.user_id === profile.user_id);
        return {
          ...profile,
          role_id: userRole?.id,
          role: userRole?.role,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string | undefined, newRole: string) => {
    try {
      if (roleId) {
        // Update existing role
        await userRolesAPI.update(roleId, { role: newRole });
      } else {
        // Insert new role
        await userRolesAPI.create({
          id: generateUUID(),
          user_id: userId,
          role: newRole,
          created_at: new Date().toISOString(),
        });
      }

      toast.success("Grupo atualizado com sucesso!");
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao atualizar grupo:", error);
      toast.error("Erro ao atualizar grupo: " + error.message);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Tem certeza que deseja remover o grupo deste usuário?")) return;

    try {
      await userRolesAPI.delete(roleId);
      toast.success("Grupo removido com sucesso!");
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao remover grupo:", error);
      toast.error("Erro ao remover grupo: " + error.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
        {users.length === 0 ? (
          <p className="text-muted-foreground">Nenhum usuário cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name || "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role || ""}
                      onValueChange={(value) =>
                        handleRoleChange(user.user_id, user.role_id, value)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Sem grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="visualizador">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role_id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRole(user.role_id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </div>
  );
};

export default UsersList;
