#!/bin/sh
IMAGES="cpp python java haskell extra"
for image in $IMAGES; do
    docker pull jutgeorg/$image
done