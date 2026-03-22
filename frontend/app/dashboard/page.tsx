"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Calendar,
  Car,
  UserCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  useGetBookingsQuery,
  Booking
} from "../api/bookingsApi";
import { useGetCustomersQuery } from "../api/customersApi";
import { useGetDriversQuery } from "../api/driversApi";
import { useGetVehiclesQuery } from "../api/fleetApi";
import { useGetUsersQuery } from "../api/userApi";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function Dashboard() {
  // Fetch data from multiple APIs
  const { data: bookings = [], isLoading: isLoadingBookings } = useGetBookingsQuery();
  const { data: customers = [], isLoading: isLoadingCustomers } = useGetCustomersQuery();
  const { data: drivers = [], isLoading: isLoadingDrivers } = useGetDriversQuery();
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useGetVehiclesQuery();
  const { data: users = [], isLoading: isLoadingUsers } = useGetUsersQuery();

  // Loading state
  const isLoading = isLoadingBookings || isLoadingCustomers || isLoadingDrivers || isLoadingVehicles || isLoadingUsers;

  // Process data for charts and stats
  const stats = useMemo(() => [
    {
      title: "Total Bookings",
      value: bookings.length,
      icon: Calendar,
      trend: "+12.5%",
      trendUp: true,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
    },
    {
      title: "Active Customers",
      value: customers.length,
      icon: Users,
      trend: "+5.2%",
      trendUp: true,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
    },
    {
      title: "Fleet Utilization",
      value: `${vehicles.filter(v => v.status === "On Trip").length}/${vehicles.length}`,
      icon: Car,
      trend: "Optimal",
      trendUp: true,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    },
    {
      title: "Active Drivers",
      value: drivers.length,
      icon: UserCheck,
      trend: "Steady",
      trendUp: true,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    }
  ], [bookings, customers, vehicles, drivers]);

  // Mock booking trend data for the AreaChart
  // In a real app, this would be derived from actual booking history
  const bookingTrendData = useMemo(() => [
    { name: "Mon", bookings: 4 },
    { name: "Tue", bookings: 7 },
    { name: "Wed", bookings: 5 },
    { name: "Thu", bookings: 12 },
    { name: "Fri", bookings: 18 },
    { name: "Sat", bookings: 15 },
    { name: "Sun", bookings: 9 }
  ], []);

  // Fleet status data for the PieChart
  const fleetStatusData = useMemo(() => [
    { name: "Available", value: vehicles.filter(v => v.status === "Available").length, fill: "#10b981" },
    { name: "On Trip", value: vehicles.filter(v => v.status === "On Trip").length, fill: "#3b82f6" },
    { name: "Maintenance", value: vehicles.filter(v => v.status === "Maintenance").length, fill: "#ef4444" }
  ].filter(item => item.value > 0), [vehicles]);

  const recentBookings = useMemo(() => {
    return [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 space-y-8"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Operations Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back! Here's what's happening today in the system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex gap-2">
            <Clock className="w-4 h-4" />
            Schedule View
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            Quick Create
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div key={index} variants={itemVariants}>
            <Card className="overflow-hidden border-none shadow-md bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${stat.color} border`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className={stat.trendUp ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-slate-500"}>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {stat.trend}
                  </Badge>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</h3>
                  <div className="text-3xl font-bold mt-1 text-slate-900 dark:text-slate-100">{stat.value}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full border-none shadow-md bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between pb-8">
              <div>
                <CardTitle className="text-lg font-semibold">Booking Trends</CardTitle>
                <CardDescription>Daily booking volume for the current week</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">
                View Report
              </Button>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ChartContainer config={{
                bookings: { label: "Bookings", color: "#3b82f6" }
              }} className="h-full w-full">
                <AreaChart data={bookingTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="bookings"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorBookings)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Fleet Distribution */}
        <motion.div variants={itemVariants}>
          <Card className="h-full border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Fleet Status</CardTitle>
              <CardDescription>Current vehicle availability</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-2">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {fleetStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full mt-6 text-center">
                <div>
                  <div className="text-xl font-bold">{vehicles.filter(v => v.status === "Available").length}</div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Free</div>
                </div>
                <div className="border-x border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-bold text-blue-600">{vehicles.filter(v => v.status === "On Trip").length}</div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Active</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-500">{vehicles.filter(v => v.status === "Maintenance").length}</div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Repair</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-none shadow-md bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Recent Bookings</CardTitle>
                <CardDescription>Latest service requests across the network</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bookings" className="flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>DateTime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.length > 0 ? (
                    recentBookings.map((booking: Booking) => (
                      <TableRow key={booking.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-medium pl-6">
                          <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-slate-100">{booking.customerName}</span>
                            <span className="text-xs text-slate-500 font-normal">{booking.customerEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-slate-500 max-w-[150px] truncate">
                            <span>{booking.pickupLocation}</span>
                            <span className="opacity-60">to {booking.dropoffLocation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium">{booking.date}</span>
                            <span>{booking.startTime}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              booking.status === "Confirmed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2" :
                                booking.status === "Pending" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2" :
                                  "bg-slate-100 text-slate-700 hover:bg-slate-100 border-none px-2"
                            }
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <span>No bookings found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & System Info */}
        <motion.div variants={itemVariants} className="space-y-6">

          <Card className="border-none shadow-md bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/50 border-none hover:bg-slate-100 transition-all">
                <Plus className="w-4 h-4" />
                <span className="text-xs">Add Driver</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/50 border-none hover:bg-slate-100 transition-all">
                <Users className="w-4 h-4" />
                <span className="text-xs">New Client</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/50 border-none hover:bg-slate-100 transition-all">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Schedule</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/50 border-none hover:bg-slate-100 transition-all">
                <Car className="w-4 h-4" />
                <span className="text-xs">Inventory</span>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
