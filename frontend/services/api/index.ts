// Barrel export for all API slices
export { bookingsApi, useGetBookingsQuery, useGetBookingByIdQuery, useCreateBookingMutation, useUpdateBookingMutation, useDeleteBookingMutation } from "./bookings.api";
export { customersApi, useGetCustomersQuery, useGetCustomerByIdQuery, useCreateCustomerMutation, useUpdateCustomerMutation, useDeleteCustomerMutation } from "./customers.api";
export { driversApi, useGetDriversQuery, useGetDriverByIdQuery, useCreateDriverMutation, useUpdateDriverMutation, useDeleteDriverMutation } from "./drivers.api";
export { fleetApi, useGetVehiclesQuery, useGetVehicleByIdQuery, useCreateVehicleMutation, useUpdateVehicleMutation, useDeleteVehicleMutation } from "./fleet.api";
export { userApi, useGetUsersQuery, useGetUserByIdQuery, useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation } from "./user.api";
export { API_BASE_URL, baseQuery } from "./base-query";
