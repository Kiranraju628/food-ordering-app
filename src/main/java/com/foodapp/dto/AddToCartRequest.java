package com.foodapp.dto;

import lombok.Data;

@Data
public class AddToCartRequest {
    private Long foodItemId;
    private Integer quantity;
}
