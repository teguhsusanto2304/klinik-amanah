package com.teguh.klinikamanah.klinikamanah_api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Staff account; only its name is shown with the documents it created or cancelled.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

    private Long clinicId;

    private String name;

    private String email;
}
