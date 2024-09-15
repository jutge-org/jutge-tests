# R script that is used to check the correctness of the submission

library("codetools")

#Perform all R commands to check the code correctness
source("wrapper.R")

#Check R code for possible problems
checkUsage(wrapper_R)
