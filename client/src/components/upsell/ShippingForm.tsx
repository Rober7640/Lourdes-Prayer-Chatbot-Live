import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShippingFormProps {
  onSubmit: (shipping: ShippingData) => void;
  disabled?: boolean;
  buttonText?: string;
}

export interface ShippingData {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export default function ShippingForm({
  onSubmit,
  disabled = false,
  buttonText = "Confirm Your Address",
}: ShippingFormProps) {
  const [shipping, setShipping] = useState<ShippingData>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postal: "",
    country: "United States",
  });
  const [errors, setErrors] = useState<Partial<ShippingData>>({});

  const handleChange = (field: keyof ShippingData, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<ShippingData> = {};

    if (!shipping.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!shipping.address1.trim()) {
      newErrors.address1 = "Address is required";
    }
    if (!shipping.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!shipping.postal.trim()) {
      newErrors.postal = "Postal code is required";
    }
    if (!shipping.country.trim()) {
      newErrors.country = "Country is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(shipping);
    }
  };

  return (
    <Card className="w-full max-w-[450px] border-card-border bg-card/85 p-5 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Shipping Address
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Ships directly from France. Arrives in 7-10 days (USA) or 14 days (international).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            value={shipping.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Your full name"
            className={`h-10 rounded-xl mt-1 ${errors.name ? "border-red-500" : ""}`}
            disabled={disabled}
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address1" className="text-sm font-medium">
            Address Line 1
          </Label>
          <Input
            id="address1"
            type="text"
            value={shipping.address1}
            onChange={(e) => handleChange("address1", e.target.value)}
            placeholder="Street address"
            className={`h-10 rounded-xl mt-1 ${errors.address1 ? "border-red-500" : ""}`}
            disabled={disabled}
          />
          {errors.address1 && (
            <p className="text-xs text-red-500 mt-1">{errors.address1}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address2" className="text-sm font-medium">
            Address Line 2 <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="address2"
            type="text"
            value={shipping.address2}
            onChange={(e) => handleChange("address2", e.target.value)}
            placeholder="Apartment, suite, etc."
            className="h-10 rounded-xl mt-1"
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city" className="text-sm font-medium">
              City
            </Label>
            <Input
              id="city"
              type="text"
              value={shipping.city}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="City"
              className={`h-10 rounded-xl mt-1 ${errors.city ? "border-red-500" : ""}`}
              disabled={disabled}
            />
            {errors.city && (
              <p className="text-xs text-red-500 mt-1">{errors.city}</p>
            )}
          </div>

          <div>
            <Label htmlFor="state" className="text-sm font-medium">
              State/Province
            </Label>
            <Input
              id="state"
              type="text"
              value={shipping.state}
              onChange={(e) => handleChange("state", e.target.value)}
              placeholder="State"
              className="h-10 rounded-xl mt-1"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="postal" className="text-sm font-medium">
              Postal Code
            </Label>
            <Input
              id="postal"
              type="text"
              value={shipping.postal}
              onChange={(e) => handleChange("postal", e.target.value)}
              placeholder="ZIP / Postal"
              className={`h-10 rounded-xl mt-1 ${errors.postal ? "border-red-500" : ""}`}
              disabled={disabled}
            />
            {errors.postal && (
              <p className="text-xs text-red-500 mt-1">{errors.postal}</p>
            )}
          </div>

          <div>
            <Label htmlFor="country" className="text-sm font-medium">
              Country
            </Label>
            <Input
              id="country"
              type="text"
              value={shipping.country}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="Country"
              className={`h-10 rounded-xl mt-1 ${errors.country ? "border-red-500" : ""}`}
              disabled={disabled}
            />
            {errors.country && (
              <p className="text-xs text-red-500 mt-1">{errors.country}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={disabled}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium mt-4"
        >
          {buttonText}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Free shipping included.
        </p>
      </form>
    </Card>
  );
}
