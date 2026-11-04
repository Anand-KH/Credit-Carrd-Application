import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9+()\-\s]{8,20}$/, "Please provide a valid phone number."],
    },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true, default: "India" },
    },
    annualIncome: {
      type: Number,
      required: true,
      min: 0,
    },
    employmentType: {
      type: String,
      enum: ["salaried", "self_employed", "business_owner", "retired"],
      required: true,
    },
    panLast4: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]{4}$/, "PAN last 4 must be 4 alphanumeric characters."],
    },
    isEligibleForNewApplication: {
      type: Boolean,
      default: true,
    },
    eligibilityLockVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

applicantSchema.index({ user: 1 }, { unique: true });
applicantSchema.index({ annualIncome: 1 });

export const Applicant = mongoose.model("Applicant", applicantSchema);

export default Applicant;
