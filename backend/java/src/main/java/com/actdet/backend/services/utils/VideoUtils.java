package com.actdet.backend.services.utils;

import org.springframework.util.StringUtils;

import java.nio.file.Path;

public class VideoUtils {

    public static int getFileDepth(Path path){
        return StringUtils.countOccurrencesOf(path.toString(), "\\");
    }

}
