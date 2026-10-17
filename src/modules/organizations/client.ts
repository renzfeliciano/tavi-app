// Browser-safe exports of the organizations module.
export { BUSINESS_PROFILE_LIMITS, REGISTRATION_LIMITS } from "./domain/limits";
export {
  REGISTRATION_FIELDS,
  type RegisteringOffice,
  type RegistrationDetails,
  type RegistrationField,
} from "./domain/registration";
export { classifyQrValue, type PaymentQr, PAYMENT_QR_LIMITS, type RawPaymentQr } from "./domain/payment-qr";
export {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  invitationReturnPath,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  TEAM_LIMITS,
} from "./domain/team";
