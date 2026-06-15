package com.foodapp.enums;

public class Enums {
    public enum RoleName {
        ROLE_CUSTOMER,
        ROLE_ADMIN,
        ROLE_RESTAURANT,
        ROLE_DELIVERY
    }

    public enum OrderStatus {
        CREATED,
        ACCEPTED,
        PREPARING,
        READY_FOR_PICKUP,
        OUT_FOR_DELIVERY,
        DELIVERED,
        CANCELLED
    }

    public enum PaymentStatus {
        PENDING,
        COMPLETED,
        FAILED
    }

    public enum PaymentMethod {
        COD,
        CARD,
        UPI
    }

    public enum DeliveryStatus {
        ASSIGNED,
        PICKED_UP,
        DELIVERED
    }
}
