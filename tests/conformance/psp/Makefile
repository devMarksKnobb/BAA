TARGET = baa_psp_fixture
OBJS = main.o probe.o
BUILD_PRX = 0
BAA_PSP_GLOBAL ?= 7
CFLAGS = -O0 -g -G0 -fno-inline -fno-builtin -DBAA_PSP_GLOBAL=$(BAA_PSP_GLOBAL)
ASFLAGS = -g
PSPSDK := $(shell psp-config --pspsdk-path)
include $(PSPSDK)/lib/build.mak
