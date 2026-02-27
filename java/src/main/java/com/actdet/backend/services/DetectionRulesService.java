package com.actdet.backend.services;

import com.actdet.backend.data.entities.DetectionElement;
import com.actdet.backend.data.entities.DetectionTag;
import com.actdet.backend.data.entities.DetectionVector;
import com.actdet.backend.data.repositories.DetectionElementRepository;
import com.actdet.backend.data.repositories.DetectionTagRepository;
import com.actdet.backend.services.dtos.DetectionRuleDTO;
import com.actdet.backend.services.dtos.DetectionVectorDTO;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DetectionRulesService {

    private DetectionTagRepository detectionTagRepository;
    private DetectionElementRepository detectionElementRepository;

    @Autowired
    public DetectionRulesService(DetectionTagRepository detectionTagRepository, DetectionElementRepository detectionElementRepository) {
        this.detectionTagRepository = detectionTagRepository;
    }

    public List<DetectionRuleDTO> getAllDetectionRules(){
        List<DetectionRuleDTO> rules = this.detectionTagRepository.findAll().stream()
                .map(DetectionRuleDTO::from).toList();
        return rules;
    }

    @Transactional
    public void addNewDetectionRule(String ruleName, List<DetectionVectorDTO> detectionVectors){
        DetectionTag tag = new DetectionTag(ruleName, new ArrayList<>());
        Set<String> elementNames = detectionVectors.stream()
                .map(DetectionVectorDTO::getElementName)
                .collect(Collectors.toSet());
        Map<String, DetectionElement> elementsByName = detectionElementRepository.findByNameIn(elementNames).stream()
                .collect(Collectors.toMap(DetectionElement::getName, element -> element));

        for(String name : elementNames){
            elementsByName.computeIfAbsent(name, n -> {
                DetectionElement e = new DetectionElement();
                e.setName(n);
                return e;
            });
        }
        List<DetectionElement> newElements = elementsByName.values().stream()
                .filter(element -> element.getId() == null).toList();

        if(!newElements.isEmpty()){
            detectionElementRepository.saveAll(newElements);
            detectionElementRepository.flush();
        }

        for( DetectionVectorDTO dto : detectionVectors){
            DetectionVector vector = new DetectionVector();
            vector.setTag(tag);
            vector.setElement(elementsByName.get(dto.getElementName()));
            if(dto.isRange()){
                vector.setCountFrom(dto.getCountFrom());
                vector.setCountTo(dto.getCountTo());
            }else{
                vector.setCount(dto.getCount());
            }
            tag.getDetectionVectors().add(vector);
        }

        detectionTagRepository.save(tag);
    }

    @Transactional
    public void deleteDetectionRule(String ruleName){
        DetectionTag tag = detectionTagRepository.findByName(ruleName)
                .orElseThrow(() -> new RecordNotFoundException("Specified rule does not exist"));
        detectionTagRepository.delete(tag);
    }

    public void editDetectionRule(String ruleName, List<DetectionVectorDTO> newOrEditedDetectionVectors){
        editDetectionRule(ruleName, ruleName, newOrEditedDetectionVectors);
    }

    @Transactional
    public void editDetectionRule(String oldRuleName, String newRuleName, List<DetectionVectorDTO> newOrEditedDetectionVectors){
        DetectionTag tag = detectionTagRepository.findByName(oldRuleName)
                .orElseThrow(() -> new RecordNotFoundException("Specified rule does not exist"));
        tag.setName(newRuleName);
        Set<String> elementNames = newOrEditedDetectionVectors.stream()
                .map(DetectionVectorDTO::getElementName)
                .collect(Collectors.toSet());
        Map<String, DetectionElement> elementsByName = detectionElementRepository.findByNameIn(elementNames).stream()
                .collect(Collectors.toMap(DetectionElement::getName, element -> element));

        for(String name : elementNames){
            elementsByName.computeIfAbsent(name, n -> {
                DetectionElement e = new DetectionElement();
                e.setName(n);
                return e;
            });
        }
        List<DetectionElement> newElements = elementsByName.values().stream()
                .filter(element -> element.getId() == null).toList();

        if(!newElements.isEmpty()){
            detectionElementRepository.saveAll(newElements);
            detectionElementRepository.flush();
        }

        Set<String> elementNamesAlreadyExistingInRule = tag.getDetectionVectors().stream()
                .map(DetectionVector::getElementName).collect(Collectors.toSet());
        Map<Boolean, List<DetectionVectorDTO>> partitionResult = newOrEditedDetectionVectors.stream()
                .collect(Collectors.partitioningBy(v -> elementNamesAlreadyExistingInRule.contains(v.getElementName())));

        List<DetectionVectorDTO> editedVectors = partitionResult.get(true);
        List<DetectionVectorDTO> newVectors = partitionResult.get(false);
        Map<String, DetectionVector> vectorsToEdit = tag.getDetectionVectors().stream()
                .collect(Collectors.toMap(DetectionVector::getElementName, v-> v));

        tag.setDetectionVectors(new ArrayList<>());
        for(DetectionVectorDTO dto : newVectors){
            DetectionVector vector = new DetectionVector();
            vector.setTag(tag);
            vector.setElement(elementsByName.get(dto.getElementName()));
            if(dto.isRange()){
                vector.setCountFrom(dto.getCountFrom());
                vector.setCountTo(dto.getCountTo());
            }else{
                vector.setCount(dto.getCount());
            }
            tag.getDetectionVectors().add(vector);
        }


        for(DetectionVectorDTO dto : editedVectors){
            DetectionVector dv = vectorsToEdit.get(dto.getElementName());
            dv.setCount(dto.getCount());
            dv.setCountFrom(dto.getCountFrom());
            dv.setCountTo(dto.getCountTo());
            tag.getDetectionVectors().add(dv);
        }

        detectionTagRepository.save(tag);
    }



}
