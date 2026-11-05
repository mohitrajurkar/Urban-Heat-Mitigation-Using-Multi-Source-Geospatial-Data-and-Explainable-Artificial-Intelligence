package com.urbanheat.repository;

import com.urbanheat.entity.StudyArea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudyAreaRepository extends JpaRepository<StudyArea, Long> {
    Optional<StudyArea> findByCode(String code);
}
