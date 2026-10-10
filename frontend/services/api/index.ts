// Barrel export for all API slices
export { API_BASE_URL, baseQuery } from "./base-query";
export {
  bookingsApi,
  useCreateBookingMutation,
  useDeleteBookingMutation,
  useGetBookingByIdQuery,
  useGetBookingsQuery,
  useLazySearchCustomersQuery,
  useUpdateBookingMutation,
} from "./bookings.api";
export {
  customersApi,
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
  useGetCustomerByIdQuery,
  useGetCustomersQuery,
  useUpdateCustomerMutation,
} from "./customers.api";
export {
  depotsApi,
  useCreateDepotMutation,
  useDeleteDepotMutation,
  useGetDepotByIdQuery,
  useGetDepotsQuery,
  useUpdateDepotMutation,
} from "./depot.api";
export type { Depot } from "./depot.api";
export {
  dispatchApi,
  useAcquireLockMutation,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useGetBoardDataQuery,
  useReleaseLockMutation,
  useUpdateAssignmentMutation,
} from "./dispatch.api";
export {
  // Backward compatibility aliases
  driversApi,
  employeesApi,
  useAddDriverAvailabilityMutation,
  useAddEmployeeAvailabilityMutation,
  useCreateDriverMutation,
  useCreateEmployeeMutation,
  useDeleteDriverMutation,
  useDeleteEmployeeMutation,
  useGetDriverAvailabilityQuery,
  useGetDriverByIdQuery,
  useGetDriversQuery,
  useGetEmployeeAvailabilityQuery,
  useGetEmployeeByIdQuery,
  useGetEmployeesQuery,
  useUpdateDriverMutation,
  useUpdateEmployeeMutation,
} from "./employees.api";
export {
  fleetApi,
  useCreateVehicleMutation,
  useDeleteVehicleMutation,
  useGetVehicleByIdQuery,
  useGetVehiclesQuery,
  useUpdateVehicleMutation,
} from "./fleet.api";
export {
  settingsApi,
  useGetSchedulingSettingsQuery,
  useUpdateSchedulingSettingsMutation,
} from "./settings.api";
export type { SchedulingSettings } from "./settings.api";
export {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUserByIdQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
  userApi,
} from "./user.api";
