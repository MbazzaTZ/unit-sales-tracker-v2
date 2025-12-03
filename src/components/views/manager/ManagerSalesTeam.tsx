import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Target, TrendingUp } from 'lucide-react';
import { calculateSaleCommission, getDSRTier, calculateBonusCommission } from '@/types/commission';

interface TeamPerformance {
  teamId: string;
  teamName: string;
  totalSales: number;
  totalRevenue: number;
  dsrCount: number;
}

interface TLPerformance {
  tlId: string;
  tlName: string;
  region: string;
  territory: string;
  totalSales: number;
  totalRevenue: number;
  dsrCount: number;
  target: number;
  achievement: number;
}

interface DSRDetails {
  dsrId: string;
  dsrName: string;
  territory: string;
  team: string;
  teamLeader: string;
  monthlySales: number;
  monthlyRevenue: number;
  tier: string;
  eligibleCommission: number;
  pendingCommission: number;
}

interface TSMPerformance {
  managerId: string;
  managerName: string;
  managerType: 'TSM' | 'RSM';
  zone: string;
  territories: string[];
  totalTLs: number;
  totalDSRs: number;
  totalSales: number;
  totalRevenue: number;
  target: number;
  achievement: number;
}

export default function ManagerSalesTeam() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentManagerInfo, setCurrentManagerInfo] = useState<any>(null);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [tlPerformance, setTLPerformance] = useState<TLPerformance[]>([]);
  const [tsmPerformance, setTSMPerformance] = useState<TSMPerformance[]>([]);
  const [dsrDetails, setDSRDetails] = useState<DSRDetails[]>([]);

  useEffect(() => {
    if (user) {
      fetchSalesTeamData();
    }
  }, [user]);

  const fetchSalesTeamData = async () => {
    try {
      setLoading(true);

      // Get current user's manager info
      const { data: managerData, error: managerInfoError } = await supabase
        .from('managers')
        .select('id, manager_type, zone_id, territory_ids')
        .eq('user_id', user?.id)
        .single();

      if (managerInfoError && managerInfoError.code !== 'PGRST116') {
        console.error('Error fetching manager info:', managerInfoError);
      }

      setCurrentManagerInfo(managerData);

      // Fetch all DSRs with their relationships
      const { data: dsrs, error: dsrError } = await supabase
        .from('dsrs')
        .select(`
          id,
          territory,
          created_at,
          profiles!dsrs_user_id_fkey (
            full_name
          ),
          teams!dsrs_team_id_fkey (
            id,
            name
          ),
          team_leaders!dsrs_tl_id_fkey (
            id,
            region,
            territory,
            profiles!team_leaders_user_id_fkey (
              full_name
            )
          )
        `);

      if (dsrError) throw dsrError;

      // Fetch all sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*');

      if (salesError) throw salesError;

      const calculateRevenue = (saleType: string) => {
        switch (saleType) {
          case 'FS': return 65000;
          case 'DO': return 25000;
          default: return 27500;
        }
      };

      // Calculate team performance
      const teamsMap = new Map<string, TeamPerformance>();
      dsrs?.forEach(dsr => {
        const teamId = dsr.teams?.id || 'unknown';
        const teamName = dsr.teams?.name || 'Unknown Team';
        
        if (!teamsMap.has(teamId)) {
          teamsMap.set(teamId, {
            teamId,
            teamName,
            totalSales: 0,
            totalRevenue: 0,
            dsrCount: 0
          });
        }

        const team = teamsMap.get(teamId)!;
        team.dsrCount++;

        const dsrSales = sales?.filter(s => s.dsr_id === dsr.id) || [];
        team.totalSales += dsrSales.length;
        team.totalRevenue += dsrSales.reduce((sum, s) => sum + calculateRevenue(s.sale_type), 0);
      });

      setTeamPerformance(Array.from(teamsMap.values()));

      // Calculate TL performance
      const tlsMap = new Map<string, TLPerformance>();
      dsrs?.forEach(dsr => {
        const tlId = dsr.team_leaders?.id || 'unknown';
        const tlName = dsr.team_leaders?.profiles?.full_name || 'Unknown TL';
        const region = dsr.team_leaders?.region || 'N/A';
        const territory = dsr.team_leaders?.territory || 'N/A';

        if (!tlsMap.has(tlId)) {
          tlsMap.set(tlId, {
            tlId,
            tlName,
            region,
            territory,
            totalSales: 0,
            totalRevenue: 0,
            dsrCount: 0,
            target: 100, // Default target, can be made configurable
            achievement: 0
          });
        }

        const tl = tlsMap.get(tlId)!;
        tl.dsrCount++;

        const dsrSales = sales?.filter(s => s.dsr_id === dsr.id) || [];
        tl.totalSales += dsrSales.length;
        tl.totalRevenue += dsrSales.reduce((sum, s) => sum + calculateRevenue(s.sale_type), 0);
      });

      // Calculate achievement percentage
      tlsMap.forEach(tl => {
        tl.achievement = tl.target > 0 ? (tl.totalSales / tl.target) * 100 : 0;
      });

      setTLPerformance(Array.from(tlsMap.values()));

      // Calculate DSR details with commission
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const dsrDetailsList: DSRDetails[] = [];

      for (const dsr of dsrs || []) {
        const dsrSales = sales?.filter(s => s.dsr_id === dsr.id) || [];
        const monthlySales = dsrSales.filter(s => new Date(s.created_at!) >= startOfMonth);

        const monthlyRevenue = monthlySales.reduce((sum, s) => sum + calculateRevenue(s.sale_type), 0);

        // Calculate commission
        let eligibleCommission = 0;
        let pendingCommission = 0;

        monthlySales.forEach(sale => {
          const commission = calculateSaleCommission(
            sale.sale_type as any,
            sale.package_option,
            sale.payment_status as any,
            sale.admin_approved,
            sale.stock_id
          );

          if (commission.status === 'eligible') {
            eligibleCommission += commission.breakdown.totalCommission;
          } else if (commission.status === 'pending-approval') {
            pendingCommission += commission.breakdown.totalCommission;
          }
        });

        // Calculate months working
        const monthsWorking = Math.floor(
          (Date.now() - new Date(dsr.created_at!).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        const tier = getDSRTier(monthlySales.length, monthsWorking);
        const bonusCommission = calculateBonusCommission(tier, monthlySales.length);
        
        eligibleCommission += bonusCommission;

        dsrDetailsList.push({
          dsrId: dsr.id,
          dsrName: dsr.profiles?.full_name || 'Unknown',
          territory: dsr.territory || 'N/A',
          team: dsr.teams?.name || 'N/A',
          teamLeader: dsr.team_leaders?.profiles?.full_name || 'N/A',
          monthlySales: monthlySales.length,
          monthlyRevenue,
          tier,
          eligibleCommission,
          pendingCommission
        });
      }

      setDSRDetails(dsrDetailsList);

      // Fetch TSM/RSM performance based on current user's role
      let managersQuery = supabase
        .from('managers')
        .select(`
          id,
          manager_type,
          zone_id,
          territory_ids,
          profiles!managers_user_id_fkey (
            full_name
          ),
          zones!managers_zone_id_fkey (
            name
          )
        `);

      // If current user is RSM, show only TSMs in their zone/territories
      if (managerData && managerData.manager_type === 'RSM') {
        // RSM should see TSMs in their zone or territories
        if (managerData.zone_id) {
          managersQuery = managersQuery
            .eq('zone_id', managerData.zone_id)
            .eq('manager_type', 'TSM');
        } else if (managerData.territory_ids && managerData.territory_ids.length > 0) {
          // Show TSMs who manage territories within RSM's territory list
          managersQuery = managersQuery
            .eq('manager_type', 'TSM')
            .overlaps('territory_ids', managerData.territory_ids);
        }
      }
      // If TSM, show their own data only
      else if (managerData && managerData.manager_type === 'TSM') {
        managersQuery = managersQuery.eq('id', managerData.id);
      }

      const { data: managers, error: managerError } = await managersQuery;

      if (managerError) throw managerError;

      const tsmList: TSMPerformance[] = [];

      for (const manager of managers || []) {
        // Get TLs under this manager's territories
        const territoryIds = manager.territory_ids || [];
        
        let managerTLs: any[] = [];
        if (territoryIds.length > 0) {
          const { data: tls } = await supabase
            .from('team_leaders')
            .select('id')
            .in('territory_id', territoryIds);
          
          managerTLs = tls || [];
        }

        // Get DSRs under these TLs
        const tlIds = managerTLs.map(tl => tl.id);
        let managerDSRs: any[] = [];
        if (tlIds.length > 0) {
          const { data: dsrsData } = await supabase
            .from('dsrs')
            .select('id')
            .in('tl_id', tlIds);
          
          managerDSRs = dsrsData || [];
        }

        // Calculate total sales and revenue for this manager's DSRs
        const dsrIds = managerDSRs.map(d => d.id);
        const managerSales = sales?.filter(s => dsrIds.includes(s.dsr_id)) || [];
        const totalRevenue = managerSales.reduce((sum, s) => sum + calculateRevenue(s.sale_type), 0);

        // Get territory names
        let territoryNames: string[] = [];
        if (territoryIds.length > 0) {
          const { data: territories } = await supabase
            .from('territories')
            .select('name')
            .in('id', territoryIds);
          
          territoryNames = territories?.map(t => t.name) || [];
        }

        tsmList.push({
          managerId: manager.id,
          managerName: manager.profiles?.full_name || 'Unknown',
          managerType: manager.manager_type as 'TSM' | 'RSM',
          zone: manager.zones?.name || 'N/A',
          territories: territoryNames,
          totalTLs: managerTLs.length,
          totalDSRs: managerDSRs.length,
          totalSales: managerSales.length,
          totalRevenue,
          target: 500, // Default target, can be made configurable
          achievement: 500 > 0 ? (managerSales.length / 500) * 100 : 0
        });
      }

      setTSMPerformance(tsmList);
    } catch (error) {
      console.error('Error fetching sales team data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Team Performance</h1>
        <p className="text-muted-foreground">Track teams, TLs, and DSR performance</p>
      </div>

      <Tabs defaultValue="teams" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="tls">Team Leaders</TabsTrigger>
          <TabsTrigger value="tsm">TSM/RSM</TabsTrigger>
          <TabsTrigger value="dsrs">DSRs</TabsTrigger>
        </TabsList>

        {/* Teams Performance */}
        <TabsContent value="teams" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamPerformance.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teamPerformance.reduce((sum, t) => sum + t.totalSales, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  TZS {teamPerformance.reduce((sum, t) => sum + t.totalRevenue, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Name</TableHead>
                    <TableHead>DSRs</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Avg Sales/DSR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamPerformance.map((team) => (
                    <TableRow key={team.teamId}>
                      <TableCell className="font-medium">{team.teamName}</TableCell>
                      <TableCell>{team.dsrCount}</TableCell>
                      <TableCell>{team.totalSales}</TableCell>
                      <TableCell>TZS {team.totalRevenue.toLocaleString()}</TableCell>
                      <TableCell>
                        {team.dsrCount > 0 ? (team.totalSales / team.dsrCount).toFixed(1) : '0'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Leaders Performance */}
        <TabsContent value="tls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Leader Performance & Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>DSRs</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tlPerformance.map((tl) => (
                    <TableRow key={tl.tlId}>
                      <TableCell className="font-medium">{tl.tlName}</TableCell>
                      <TableCell>{tl.region}</TableCell>
                      <TableCell>{tl.territory}</TableCell>
                      <TableCell>{tl.dsrCount}</TableCell>
                      <TableCell>{tl.totalSales}</TableCell>
                      <TableCell>{tl.target}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={tl.achievement >= 100 ? 'default' : tl.achievement >= 75 ? 'secondary' : 'destructive'}
                        >
                          {tl.achievement.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>TZS {tl.totalRevenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TSM/RSM Performance */}
        <TabsContent value="tsm" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Managers</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tsmPerformance.length}</div>
                <p className="text-xs text-muted-foreground">
                  TSM: {tsmPerformance.filter(m => m.managerType === 'TSM').length} | 
                  RSM: {tsmPerformance.filter(m => m.managerType === 'RSM').length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tsmPerformance.reduce((sum, m) => sum + m.totalSales, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  TZS {tsmPerformance.reduce((sum, m) => sum + m.totalRevenue, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {currentManagerInfo?.manager_type === 'RSM' ? 'TSM Performance Under Your Management' : 'TSM/RSM Performance & Territories'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {currentManagerInfo?.manager_type === 'RSM' 
                  ? 'Territory Sales Managers reporting to you'
                  : 'Territory Sales Managers and Regional Sales Managers'}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Territories</TableHead>
                    <TableHead>TLs</TableHead>
                    <TableHead>DSRs</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tsmPerformance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {currentManagerInfo?.manager_type === 'RSM' 
                          ? 'No TSMs found under your management. Make sure TSMs are assigned to your zone/territories.'
                          : currentManagerInfo?.manager_type === 'TSM'
                          ? 'Your TSM performance data will appear here.'
                          : 'No TSM/RSM data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tsmPerformance.map((manager) => (
                      <TableRow key={manager.managerId}>
                        <TableCell className="font-medium">{manager.managerName}</TableCell>
                        <TableCell>
                          <Badge variant={manager.managerType === 'TSM' ? 'default' : 'secondary'}>
                            {manager.managerType}
                          </Badge>
                        </TableCell>
                        <TableCell>{manager.zone}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            {manager.territories.length > 0 ? (
                              <div className="text-xs">
                                {manager.territories.slice(0, 2).join(', ')}
                                {manager.territories.length > 2 && ` +${manager.territories.length - 2} more`}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{manager.totalTLs}</TableCell>
                        <TableCell>{manager.totalDSRs}</TableCell>
                        <TableCell className="font-semibold">{manager.totalSales}</TableCell>
                        <TableCell>{manager.target}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              manager.achievement >= 100 ? 'default' : 
                              manager.achievement >= 75 ? 'secondary' : 
                              'destructive'
                            }
                          >
                            {manager.achievement.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          TZS {manager.totalRevenue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DSRs Details */}
        <TabsContent value="dsrs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DSR Performance by Territory</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DSR Name</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Monthly Sales</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Eligible Commission</TableHead>
                    <TableHead>Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dsrDetails.map((dsr) => (
                    <TableRow key={dsr.dsrId}>
                      <TableCell className="font-medium">{dsr.dsrName}</TableCell>
                      <TableCell>{dsr.territory}</TableCell>
                      <TableCell>{dsr.team}</TableCell>
                      <TableCell>{dsr.teamLeader}</TableCell>
                      <TableCell>{dsr.monthlySales}</TableCell>
                      <TableCell>TZS {dsr.monthlyRevenue.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{dsr.tier}</Badge>
                      </TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        TZS {dsr.eligibleCommission.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-yellow-600">
                        TZS {dsr.pendingCommission.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
