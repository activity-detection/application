package com.actdet.backend.web.controllers;

import com.actdet.backend.services.DetectionRulesService;
import com.actdet.backend.web.controllers.bodies.CreateDetectionTemplateRequest;
import com.actdet.backend.web.controllers.bodies.EditDetectionTemplateRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/rules")
public class DetectionRulesController {

    private DetectionRulesService detectionRulesService;

    @Autowired
    public DetectionRulesController(DetectionRulesService detectionRulesService) {
        this.detectionRulesService = detectionRulesService;
    }

    @GetMapping("")
    public ResponseEntity<?> getDetectionTemplates(
            @PageableDefault(size = 10, sort = {"name"}, direction = Sort.Direction.ASC) Pageable pageable
    ){
        return ResponseEntity.ok(detectionRulesService.getAllDetectionRules(pageable));
    }

    @PostMapping("")
    public ResponseEntity<?> addDetectionTemplate(
            @Valid @RequestBody CreateDetectionTemplateRequest request
    ){
        detectionRulesService.addNewDetectionTemplate(request.getTemplateName(), request.getVectors());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/")
    public ResponseEntity<?> deleteDetectionTemplate(
        @RequestParam(name = "name") String templateName
    ){
        detectionRulesService.deleteDetectionTemplate(templateName);
        return ResponseEntity.ok().build();
    }

    @PutMapping("")
    public ResponseEntity<?> editDetectionTemplate(
            @Valid @RequestBody EditDetectionTemplateRequest request
    ){
        if(request.getNewTemplateName()==null){
            detectionRulesService.editDetectionTemplate(request.getTemplateName(), request.getVectors());
        }else{
            detectionRulesService.editDetectionTemplate(request.getTemplateName(), request.getNewTemplateName(), request.getVectors());
        }
        return ResponseEntity.ok().build();
    }

}
